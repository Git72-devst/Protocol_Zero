'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');

const CHOICES = ['a', 'b', 'c'];
const MODES = [1, 2, 3];
const BRANCH = { energy: 0, safe: 1, pause: 2, voice: 3, dawn: 4, partial: 5 };
const TITLES = {
  energy: 'Город без энергии',
  safe: 'Аварийный рассвет',
  pause: 'Город потерян',
  voice: 'Голос города',
  dawn: 'Город нового рассвета',
  partial: 'Свет в одном окне'
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function paths(prefix = []) {
  if (prefix.length === 5) return [prefix];
  return CHOICES.flatMap(choice => paths([...prefix, choice]));
}

function play(answers) {
  const repaired = E.applyRepairChoice(E.startDrain(E.createState(), 0), 'a', 0).state;
  return answers.reduce((state, choice) => E.applyChoice(state, choice).state, repaired);
}

// Independent contract oracle: answers are correct iff the selected ID is a.
// No challenge.correct values or resolver branches are read by this oracle.
function expectedState(answers) {
  const solved = answers.map(answer => answer === 'a');
  return {
    energy: 8,
    energyLost: 0,
    draining: false,
    nextEnergyAt: null,
    leakClosed: true,
    repairAvailable: false,
    gameOver: null,
    errors: solved.filter(correct => !correct).length,
    archive: solved[1] === true,
    bridge: solved[3] === true,
    relay: solved[2] === true,
    trust: solved[4] === true ? 1 : 0,
    step: answers.length,
    mode: null
  };
}

function stateWithoutHistory(state) {
  const { history, repairHistory, ...properties } = state;
  return properties;
}

function expectedEnding(answers, mode) {
  const wrong = answers.filter(answer => answer !== 'a').length;
  if (mode === 3) return 'safe';
  if (answers[2] !== 'a' || wrong >= 3) return 'pause';
  if (mode === 2) return 'voice';
  return wrong === 0 ? 'dawn' : 'partial';
}

// QA only: translate the small Boolean-expression subset used by our static
// Pascal teaching strings. This is not a production Pascal interpreter.
const PASCAL_NAMES = new Map([
  'mode', 'errors', 'relay', 'archive', 'bridge', 'trust', 'energy',
  'hasPass', 'knowsCode', 'coolant', 'warning'
].map(name => [name.toLowerCase(), name]));

function pascalExpression(source) {
  const input = source.trim();
  const tokens = /\s*(>=|<=|<>|=|>|<|\(|\)|\d+|[A-Za-z_][A-Za-z0-9_]*)/y;
  const operators = { and: '&&', or: '||', not: '!', true: 'true', false: 'false', '=': '===', '<>': '!==' };
  const translated = [];
  let offset = 0;
  while (offset < input.length) {
    tokens.lastIndex = offset;
    const match = tokens.exec(input);
    assert.ok(match, 'unsupported token in teaching expression: ' + input.slice(offset));
    const token = match[1];
    const normalized = token.toLowerCase();
    if (Object.hasOwn(operators, normalized)) translated.push(operators[normalized]);
    else if (PASCAL_NAMES.has(normalized)) translated.push(PASCAL_NAMES.get(normalized));
    else {
      assert.match(token, /^(?:\d+|>=|<=|>|<|\(|\))$/, 'unsupported Pascal name: ' + token);
      translated.push(token);
    }
    offset = tokens.lastIndex;
  }
  assert.ok(translated.length, 'teaching expression must not be empty');
  return new vm.Script(translated.join(' '));
}

function parsePascalEndingBranches(source) {
  const lines = source.split('\n').map(line => line.trim());
  const branches = [];
  let index = 0;
  while (index < lines.length) {
    const header = lines[index++];
    let condition = null;
    if (header === 'else') {
      assert.ok(branches.length, 'else must follow an if branch');
    } else {
      const prefix = branches.length ? /^else\s+if\s+/i : /^if\s+/i;
      assert.match(header, prefix, 'expected Pascal if/else if');
      let expression = header.replace(prefix, '');
      while (!/\s+then$/i.test(expression)) {
        assert.ok(index < lines.length, 'condition must end in then');
        expression += ' ' + lines[index++];
      }
      condition = pascalExpression(expression.replace(/\s+then$/i, ''));
    }
    const assignment = lines[index++];
    const match = assignment?.match(/^ending\s*:=\s*'((?:''|[^'])*)'(;?)$/i);
    assert.ok(match, 'expected Pascal ending assignment: ' + assignment);
    assert.equal(match[2], condition === null ? ';' : '', 'only the final assignment ends in a semicolon');
    branches.push({ condition, title: match[1].replace(/''/g, "'") });
    if (condition === null) assert.equal(index, lines.length, 'else must be the last branch');
  }
  assert.equal(branches.length, 6, 'six ending branches are required');
  assert.equal(branches.at(-1).condition, null, 'final else is required');
  return branches;
}

test('new games have independent state and the documented initial values', () => {
  const first = E.createState();
  const second = E.createState();
  assert.deepEqual(first, {
    energy: 8, energyLost: 0, draining: false, nextEnergyAt: null,
    leakClosed: false, repairAvailable: true, gameOver: null, repairHistory: [],
    errors: 0, archive: false, bridge: false,
    relay: false, trust: 0, step: 0, history: [], mode: null
  });
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.history, second.history);
  first.history.push({ sentinel: true });
  assert.equal(second.history.length, 0);
});

test('five missions have unique IDs, exactly three choices and exactly one correct rule', () => {
  assert.equal(E.challenges.length, 5);
  assert.equal(new Set(E.challenges.map(challenge => challenge.id)).size, 5);
  for (const challenge of E.challenges) {
    assert.equal(challenge.choices.length, 3);
    assert.deepEqual(challenge.choices.map(choice => choice.id).sort(), CHOICES);
    assert.deepEqual(challenge.choices.filter(choice => choice.correct).map(choice => choice.id), ['a']);
    assert.ok(challenge.expected.length);
    assert.ok(challenge.explanation.length);
  }
});

test('all 3^5 routes and all 729 final choices obey state, history and immutability invariants', () => {
  const allPaths = paths();
  assert.equal(allPaths.length, 243);
  const counts = { energy: 0, safe: 0, pause: 0, voice: 0, dawn: 0, partial: 0 };
  let endingsChecked = 0;

  for (const answers of allPaths) {
    let state = play([]);
    for (let step = 0; step < answers.length; step++) {
      const label = answers.join('') + ' step ' + step;
      assert.strictEqual(E.getChallenge(state), E.challenges[step], label);
      const snapshot = structuredClone(state);
      deepFreeze(state);
      const transition = E.applyChoice(state, answers[step]);
      const next = transition.state;
      assert.deepEqual(state, snapshot, label + ': input was changed');
      assert.notStrictEqual(next, state, label);
      assert.notStrictEqual(next.history, state.history, label);
      assert.deepEqual(next.history.slice(0, step), state.history, label);
      assert.deepEqual(stateWithoutHistory(next), expectedState(answers.slice(0, step + 1)), label);
      assert.equal(next.history.length, step + 1, label);
      assert.equal(next.errors, next.history.filter(record => !record.correct).length, label);
      assert.equal(next.energy, 8, label + ': only elapsed time may consume energy');
      assert.equal(next.energyLost, 0, label);
      assert.ok(next.trust === 0 || next.trust === 1, label);

      const record = next.history[step];
      assert.equal(record.step, step, label);
      assert.equal(record.choiceId, answers[step], label);
      assert.equal(record.correct, answers[step] === 'a', label);
      assert.deepEqual(record.before, stateWithoutHistory(snapshot), label);
      assert.deepEqual(record.after, stateWithoutHistory(next), label);
      assert.equal(record.code, E.challenges[step].choices.find(choice => choice.id === answers[step]).code, label);
      assert.equal(record.expectedCode, E.challenges[step].expected, label);
      assert.equal(record.explanation, transition.result.explanation, label);
      assert.equal(record.message, transition.result.message, label);
      assert.ok(record.explanation.length, label);
      assert.equal(transition.result.message, answers[step] === 'a'
        ? E.challenges[step].success : E.challenges[step].failure, label);
      assert.equal(transition.result.correct, record.correct, label);
      state = next;
    }

    assert.equal(E.getChallenge(state), null, answers.join(''));
    const finishedSnapshot = structuredClone(state);
    deepFreeze(state);
    for (const mode of MODES) {
      const ending = E.resolveEnding(state, mode);
      const expected = expectedEnding(answers, mode);
      assert.equal(ending.id, expected, answers.join('') + '/' + mode);
      assert.equal(ending.branchIndex, BRANCH[expected]);
      assert.equal(ending.title, TITLES[expected]);
      assert.equal(ending.reason, ending.rule);
      assert.equal(ending.code, E.FINAL_CODE);
      assert.deepEqual(state, finishedSnapshot, 'ending selection must not change state');
      counts[ending.id]++;
      endingsChecked++;
    }
  }

  assert.equal(endingsChecked, 729);
  // Wrong variants b/c are separate routes, hence different counts from 32 binary profiles.
  assert.deepEqual(counts, { energy: 0, safe: 243, pause: 420, voice: 33, dawn: 1, partial: 32 });
});

test('both wrong variants have the same consequences on every mission', () => {
  for (let step = 0; step < 5; step++) {
    const prefix = Array(step).fill('a');
    const state = play(prefix);
    const b = E.applyChoice(state, 'b').state;
    const c = E.applyChoice(state, 'c').state;
    assert.deepEqual(stateWithoutHistory(b), stateWithoutHistory(c));
    assert.equal(b.errors, 1);
    assert.equal(b.energy, 8, 'wrong choices never cause an instant energy penalty');
  }
});

test('unknown choices are rejected without changing a state', () => {
  for (let step = 0; step < 5; step++) {
    const state = deepFreeze(play(Array(step).fill('a')));
    const snapshot = structuredClone(state);
    for (const choice of ['', 'd', 'A', 0, null, undefined]) {
      assert.throws(() => E.applyChoice(state, choice, 50000), /Неизвестный вариант/);
      assert.deepEqual(state, snapshot);
    }
  }
});

test('a sixth answer is rejected after all five missions', () => {
  const state = deepFreeze(play(['a', 'a', 'a', 'a', 'a']));
  assert.throws(() => E.applyChoice(state, 'a'), /Все задания уже завершены/);
  assert.equal(state.history.length, 5);
  assert.equal(state.errors, 0);
});

test('endings cannot be requested early and unknown modes are rejected', () => {
  for (let completed = 0; completed < 5; completed++) {
    const state = deepFreeze(play(Array(completed).fill('a')));
    for (const mode of MODES) {
      assert.throws(() => E.resolveEnding(state, mode), /Сначала завершите все пять заданий/);
    }
  }
  const state = deepFreeze(play(Array(5).fill('a')));
  for (const mode of ['', 'Restore', 'default', null, undefined, 0]) {
    assert.throws(() => E.resolveEnding(state, mode), /Неизвестный режим/);
  }
});

test('threshold of three errors blocks a powered core and shutdown overrides that block', () => {
  const twoErrors = play(['b', 'b', 'a', 'a', 'a']);
  const threeErrors = play(['b', 'b', 'a', 'b', 'a']);
  assert.equal(twoErrors.errors, 2);
  assert.equal(threeErrors.errors, 3);
  assert.equal(twoErrors.relay, true);
  assert.equal(threeErrors.relay, true);
  assert.equal(E.resolveEnding(twoErrors, 1).id, 'partial');
  assert.equal(E.resolveEnding(twoErrors, 2).id, 'voice');
  assert.equal(E.resolveEnding(threeErrors, 1).id, 'pause');
  assert.equal(E.resolveEnding(threeErrors, 2).id, 'pause');
  assert.equal(E.resolveEnding(threeErrors, 3).id, 'safe');
});

test('a failed relay blocks restore and autonomy even with only one error', () => {
  const state = play(['a', 'a', 'b', 'a', 'a']);
  assert.equal(state.errors, 1);
  assert.equal(state.relay, false);
  assert.equal(E.resolveEnding(state, 1).id, 'pause');
  assert.equal(E.resolveEnding(state, 2).id, 'pause');
  assert.equal(E.resolveEnding(state, 3).id, 'safe');
});

test('mode order distinguishes three endings for the same perfect state', () => {
  const state = deepFreeze(play(['a', 'a', 'a', 'a', 'a']));
  assert.equal(E.resolveEnding(state, 1).id, 'dawn');
  assert.equal(E.resolveEnding(state, 2).id, 'voice');
  assert.equal(E.resolveEnding(state, 3).id, 'safe');
});

test('full restoration includes the energy boundary and all explicit system guards', () => {
  const perfect = play(['a', 'a', 'a', 'a', 'a']);
  // Synthetic final snapshots isolate predicates that reachable perfect routes share.
  assert.equal(E.resolveEnding({ ...perfect, energy: 4 }, 1).id, 'dawn');
  assert.equal(E.resolveEnding({ ...perfect, energy: 3 }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, energy: 2 }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, energy: 1 }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, energy: 0 }, 1).id, 'energy');
  assert.equal(E.resolveEnding({ ...perfect, trust: 0 }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, archive: false }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, bridge: false }, 1).id, 'partial');
  assert.equal(E.resolveEnding({ ...perfect, errors: 1 }, 1).id, 'partial');
});

test('Pascal teaching expressions handle equality, OR, NOT and both relay safety requirements', () => {
  const gate = pascalExpression(E.challenges[0].choices.find(choice => choice.id === 'a').code);
  const equality = pascalExpression(E.challenges[0].choices.find(choice => choice.id === 'c').code);
  for (const [energy, allowed] of [[1, false], [2, true], [3, true]]) {
    assert.equal(gate.runInNewContext({ energy }), allowed);
    assert.equal(equality.runInNewContext({ energy }), energy === 2);
  }
  const archive = pascalExpression(E.challenges[1].choices.find(choice => choice.id === 'a').code);
  const noCode = pascalExpression(E.challenges[1].choices.find(choice => choice.id === 'c').code);
  const relay = pascalExpression(E.challenges[2].choices.find(choice => choice.id === 'a').code);
  for (const first of [false, true]) {
    for (const second of [false, true]) {
      assert.equal(archive.runInNewContext({ hasPass: first, knowsCode: second }), first || second);
      assert.equal(noCode.runInNewContext({ knowsCode: second }), !second);
      assert.equal(relay.runInNewContext({ energy: first ? 2 : 1, coolant: second }), first && second);
    }
  }
  const wrongRelay = pascalExpression(E.challenges[2].choices.find(choice => choice.id === 'b').code);
  assert.equal(wrongRelay.runInNewContext({ energy: 3, coolant: false }), true);
  assert.equal(relay.runInNewContext({ energy: 3, coolant: false }), false);
});

test('integer mode values map to actions and reject unknown modes', () => {
  const expectedActions = {
    1: 'Восстановить', 2: 'Автономия', 3: 'Остановить'
  };
  const state = play(['a', 'a', 'a', 'a', 'a']);
  for (const [key, action] of Object.entries(expectedActions)) {
    const mode = Number(key);
    assert.equal(E.getModeAction(mode), action);
    assert.equal(E.resolveEnding(state, mode).action, action);
  }
  for (const mode of ['', '1', '2', '3', 'restore', null, undefined, 0, 4]) {
    assert.throws(() => E.getModeAction(mode), /Неизвестный режим/);
  }
});

test('displayed Pascal final code produces the same title as the resolver for all 729 combinations', () => {
  const branches = parsePascalEndingBranches(E.FINAL_CODE);
  let checked = 0;
  for (const answers of paths()) {
    const state = play(answers);
    for (const mode of MODES) {
      const context = { ...stateWithoutHistory(state), mode };
      const selected = branches.find(branch => branch.condition === null
        || branch.condition.runInNewContext(context, { timeout: 100 }));
      assert.equal(selected.title, E.resolveEnding(state, mode).title, answers.join('') + '/' + mode);
      checked++;
    }
  }
  assert.equal(checked, 729);
});

test('one pure global timer uses eight units, five-second boundaries and no wall clock', () => {
  assert.equal(E.MAX_ENERGY, 8);
  assert.equal(E.DRAIN_INTERVAL_MS, 5000);
  const source = fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:Date\.now|setInterval|setTimeout)\s*\(/);
  const initial = deepFreeze(E.createState());
  const running = deepFreeze(E.startDrain(initial, 0));
  assert.equal(running.nextEnergyAt, 5000);
  assert.strictEqual(E.startDrain(running, 4000), running);
  assert.strictEqual(E.advanceTime(running, 4999), running);
  const one = E.advanceTime(running, 5000);
  assert.equal(one.energy, 7);
  assert.equal(one.energyLost, 1);
  assert.equal(one.nextEnergyAt, 10000);
  assert.strictEqual(E.advanceTime(one, 9999), one);
  const two = E.advanceTime(one, 10000);
  assert.equal(two.energy, 6);
  assert.equal(two.energyLost, 2);
  assert.equal(two.nextEnergyAt, 15000);
  assert.deepEqual(E.advanceTime(running, 10000), two);
  assert.equal(initial.draining, false);
  assert.equal(running.energy, 8);
});

test('delayed ticks catch up, preserve phase and finish immediately at zero', () => {
  const running = deepFreeze(E.startDrain(E.createState(), 100));
  const delayed = E.advanceTime(running, 26100);
  assert.equal(delayed.energy, 3);
  assert.equal(delayed.energyLost, 5);
  assert.equal(delayed.nextEnergyAt, 30100);
  const empty = E.advanceTime(deepFreeze(delayed), 1000000000);
  assert.equal(empty.energy, 0);
  assert.equal(empty.energyLost, 8);
  assert.equal(empty.gameOver, 'energy');
  assert.equal(empty.draining, false);
  assert.equal(empty.nextEnergyAt, null);
  assert.strictEqual(E.advanceTime(empty, 2000000000), empty);
  assert.strictEqual(E.startDrain(empty, 2000000000), empty);
});

test('stopDrain pauses without claiming a physical repair', () => {
  const running = deepFreeze(E.startDrain(E.createState(), 0));
  const paused = E.stopDrain(running);
  assert.equal(paused.draining, false);
  assert.equal(paused.nextEnergyAt, null);
  assert.equal(paused.leakClosed, false);
  assert.strictEqual(E.stopDrain(paused), paused);
  assert.strictEqual(E.advanceTime(paused, 100000), paused);
});

test('ordinary correct answers never stop the global leak across all five stages', () => {
  let state = E.startDrain(E.createState(), 0);
  for (let step = 0; step < 5; step++) {
    deepFreeze(state);
    const answer = E.applyChoice(state, 'a', (step + 1) * 1000);
    assert.equal(answer.result.correct, true);
    assert.equal(answer.state.draining, true);
    assert.equal(answer.state.leakClosed, false);
    assert.equal(answer.state.repairHistory.length, 0);
    assert.equal(answer.state.nextEnergyAt, step === 4 ? 10000 : 5000);
    assert.doesNotMatch(answer.result.message, /утечка закрыта|утечка устранена/i);
    state = answer.state;
    assert.strictEqual(E.startDrain(state, (step + 1) * 1000 + 500), state, 'Next cannot reset phase');
  }
  assert.equal(state.step, 5);
  assert.equal(state.energy, 7);
  assert.equal(state.errors, 0);
  assert.equal(E.advanceTime(state, 10000).energy, 6);
  assert.equal(E.advanceTime(state, 40000).gameOver, 'energy');
});

test('ordinary wrong answers neither start nor stop nor reset the global leak', () => {
  const inactive = E.applyChoice(deepFreeze(E.createState()), 'b', 4000).state;
  assert.equal(inactive.draining, false);
  assert.equal(inactive.nextEnergyAt, null);
  assert.equal(inactive.energy, 8);
  const running = E.startDrain(E.createState(), 0);
  const wrong = E.applyChoice(deepFreeze(running), 'b', 4000);
  assert.equal(wrong.state.nextEnergyAt, 5000);
  assert.equal(wrong.state.errors, 1);
  assert.equal(wrong.state.energy, 8);
  const feedbackTick = E.advanceTime(wrong.state, 5000);
  assert.equal(feedbackTick.energy, 7);
  assert.strictEqual(E.startDrain(feedbackTick, 6000), feedbackTick);
  assert.equal(E.advanceTime(feedbackTick, 10000).energy, 6);
});

test('separate repair puzzle uses a physical action and a subsequent verification', () => {
  assert.deepEqual(E.repairChallenge.choices.map(choice => choice.id), ['b', 'a', 'c']);
  assert.equal(E.repairChallenge.choices.filter(choice => choice.correct).length, 1);
  const correct = E.repairChallenge.choices.find(choice => choice.id === 'a').code;
  assert.ok(correct.indexOf('CloseValve;') < correct.indexOf('if IsSealed then'));
  assert.ok(correct.indexOf('if IsSealed then') < correct.indexOf('leakClosed := true;'));
  assert.match(correct, /if leakDetected then\nbegin/);
  assert.match(E.repairChallenge.facts, /leakDetected = true/);
  assert.equal(E.repairChallenge.expected, correct);
});

test('wrong repair retries preserve phase, leave main errors unchanged and remain repairable', () => {
  let state = E.startDrain(E.createState(), 0);
  const first = E.applyRepairChoice(deepFreeze(state), 'b', 4000);
  assert.equal(first.result.correct, false);
  assert.equal(first.state.errors, 0);
  assert.equal(first.state.step, 0);
  assert.equal(first.state.history.length, 0);
  assert.equal(first.state.nextEnergyAt, 5000);
  assert.equal(first.state.repairHistory.length, 1);
  state = E.advanceTime(first.state, 5000);
  const second = E.applyRepairChoice(deepFreeze(state), 'c', 6000);
  assert.equal(second.state.nextEnergyAt, 10000);
  assert.equal(second.state.leakClosed, false, 'setting the displayed flag is not physical repair');
  assert.equal(second.state.energy, 7);
  assert.equal(second.state.errors, 0);
  const success = E.applyRepairChoice(deepFreeze(second.state), 'a', 10000);
  assert.equal(success.state.energy, 6, 'a due tick is accounted before repair');
  assert.equal(success.state.repairHistory.length, 3);
  assert.equal(success.state.leakClosed, true);
  assert.equal(success.state.draining, false);
  assert.equal(success.state.nextEnergyAt, null);
  assert.equal(success.state.errors, 0);
  assert.equal(success.state.step, 0);
  assert.match(success.result.explanation, /Запас в момент выбора: 6/);
});

test('one successful repair permanently protects energy on every later stage and feedback', () => {
  let state = E.applyRepairChoice(E.startDrain(E.createState(), 0), 'a', 14000).state;
  assert.equal(state.energy, 6);
  assert.equal(state.energyLost, 2);
  for (let step = 0; step < 5; step++) {
    deepFreeze(state);
    assert.strictEqual(E.startDrain(state, 100000 + step * 10000), state);
    assert.strictEqual(E.advanceTime(state, 200000 + step * 10000), state);
    const answer = E.applyChoice(state, step % 2 ? 'b' : 'a', 300000 + step * 10000);
    assert.equal(answer.state.energy, 6);
    assert.equal(answer.state.leakClosed, true);
    assert.equal(answer.state.draining, false);
    assert.equal(answer.state.nextEnergyAt, null);
    state = answer.state;
  }
  assert.equal(state.repairHistory.length, 1);
  assert.throws(() => E.applyRepairChoice(state, 'a', 900000), /Утечка уже устранена/);
});

test('leaving repair permanently locks it without resetting the timer, including across reload', () => {
  let state = E.startDrain(E.createState(), 0);
  state = E.applyRepairChoice(state, 'b', 4000).state;
  const left = E.leaveRepair(deepFreeze(state));
  assert.equal(left.step, 0);
  assert.equal(left.repairAvailable, false);
  assert.equal(left.draining, true);
  assert.equal(left.nextEnergyAt, 5000);
  assert.equal(left.energy, 8);
  assert.strictEqual(E.leaveRepair(left), left);
  for (const id of ['a', 'b', 'c']) {
    assert.throws(() => E.applyRepairChoice(left, id, 4000), /Ремонт больше недоступен/);
  }
  const restored = E.restoreState(JSON.parse(JSON.stringify(left)), 5000);
  assert.equal(restored.energy, 7);
  assert.equal(restored.nextEnergyAt, 10000);
  assert.equal(restored.leakClosed, false);
  assert.equal(restored.repairAvailable, false);
  assert.throws(() => E.applyRepairChoice(restored, 'a', 5000), /Ремонт больше недоступен/);
  for (const choice of ['a', 'b']) {
    const entered = E.applyChoice(restored, choice, 6000).state;
    assert.equal(entered.repairAvailable, false);
    assert.throws(() => E.applyRepairChoice(entered, 'a', 6000), /Ремонт больше недоступен/);
    const reloaded = E.restoreState(JSON.parse(JSON.stringify(entered)), 6000);
    assert.equal(reloaded.repairAvailable, false);
  }
});

test('entering any ordinary question closes the one-time repair opportunity automatically', () => {
  for (const choice of ['a', 'b', 'c']) {
    const initial = deepFreeze(E.startDrain(E.createState(), 0));
    const entered = E.applyChoice(initial, choice, 1000).state;
    assert.equal(initial.repairAvailable, true);
    assert.equal(entered.repairAvailable, false);
    assert.equal(entered.nextEnergyAt, 5000);
    assert.throws(() => E.applyRepairChoice(entered, 'a', 1000), /Ремонт больше недоступен/);
    const forged = { ...entered, repairAvailable: true };
    assert.throws(() => E.restoreState(forged, 1000), /Повреждено сохранение/);
  }
});

test('zero ends the game immediately and no late correct click can rescue it', () => {
  const running = deepFreeze(E.startDrain(E.createState(), 0));
  assert.equal(E.advanceTime(running, 39999).energy, 1);
  const ended = deepFreeze(E.advanceTime(running, 40000));
  assert.equal(ended.gameOver, 'energy');
  for (const choice of ['a', 'b', 'c', 'invalid']) {
    assert.throws(() => E.applyChoice(ended, choice, 40000), /Игра завершена/);
    assert.throws(() => E.applyRepairChoice(ended, choice, 40000), /Игра завершена/);
  }
  assert.throws(() => E.applyChoice(running, 'a', 40000), /Игра завершена/);
  assert.throws(() => E.applyRepairChoice(running, 'a', 40000), /Игра завершена/);
  assert.equal(running.energy, 8, 'pure rejected calls do not mutate their input');
  assert.equal(running.repairHistory.length, 0);
  assert.strictEqual(E.startDrain(ended, 50000), ended);
});

test('energy ending works before every stage and precedes mode guards and safe shutdown', () => {
  for (let completed = 0; completed <= 5; completed++) {
    let state = E.startDrain(E.createState(), 0);
    for (let step = 0; step < completed; step++) state = E.applyChoice(state, 'a', 0).state;
    state = E.advanceTime(state, 40000);
    for (const mode of [null, 1, 2, 3, 'invalid']) {
      const ending = E.resolveEnding(state, mode);
      assert.equal(ending.id, 'energy');
      assert.equal(ending.title, 'Город без энергии');
      assert.equal(ending.branchIndex, 0);
    }
    assert.equal(E.resolveEnding(state).id, 'energy');
  }
  const prose = E.endings.find(ending => ending.id === 'energy').text.join(' ');
  assert.match(prose, /Связь потеряна/);
  assert.doesNotMatch(prose, /Лума.*(?:советует|подсказывает|помогает исправить)/);
});

test('all six endings are reachable and unrepaired but still positive energy is allowed', () => {
  const perfect = play(['a', 'a', 'a', 'a', 'a']);
  const ids = new Set([
    E.resolveEnding(perfect, 1).id,
    E.resolveEnding(perfect, 2).id,
    E.resolveEnding(perfect, 3).id,
    E.resolveEnding(play(['a', 'b', 'a', 'a', 'a']), 1).id,
    E.resolveEnding(play(['a', 'a', 'b', 'a', 'a']), 1).id,
    E.resolveEnding(E.advanceTime(E.startDrain(E.createState(), 0), 40000)).id
  ]);
  assert.equal(ids.size, 6);
  assert.deepEqual(ids, new Set(E.endings.map(ending => ending.id)));
  let notRepaired = E.startDrain(E.createState(), 0);
  for (let i = 0; i < 5; i++) notRepaired = E.applyChoice(notRepaired, 'a', 0).state;
  assert.equal(notRepaired.leakClosed, false);
  assert.equal(E.resolveEnding(notRepaired, 1).id, 'dawn', 'repair is optional if the player finishes in time');
});

test('low-energy rules use actual values without pausing the still-open global leak', () => {
  const lowGate = E.advanceTime(E.startDrain(E.createState(), 0), 35000);
  const gate = E.applyChoice(deepFreeze(lowGate), 'a', 35000);
  assert.equal(gate.result.correct, true);
  assert.equal(gate.state.errors, 0);
  assert.equal(gate.state.draining, true);
  assert.equal(gate.state.nextEnergyAt, 40000);
  assert.match(gate.result.explanation, /1 >= 2 = false/);
  assert.match(gate.result.message, /аварийному пути/);
  assert.equal(E.challenges[0].facts(gate.result.before), 'energy = 1');
  let relayState = E.startDrain(E.createState(), 0);
  relayState = E.applyChoice(relayState, 'a', 0).state;
  relayState = E.applyChoice(relayState, 'a', 0).state;
  const relay = E.applyChoice(deepFreeze(relayState), 'a', 35000);
  assert.equal(relay.state.energy, 1);
  assert.equal(relay.state.relay, false);
  assert.equal(relay.state.errors, 0);
  assert.equal(relay.result.correct, true);
  assert.equal(relay.state.draining, true);
  assert.match(relay.result.explanation, /\(1 >= 2\) and true = false/);
});

test('final thresholds 0, 1, 3 and 4 agree with the thirteen-line Pascal algorithm', () => {
  const branches = parsePascalEndingBranches(E.FINAL_CODE);
  assert.equal(E.FINAL_CODE.split('\n').length, 13);
  let powered = E.startDrain(E.createState(), 0);
  for (let i = 0; i < 5; i++) powered = E.applyChoice(powered, 'a', 0).state;
  for (const [now, energy, restoreId] of [
    [20000, 4, 'dawn'], [25000, 3, 'partial'], [35000, 1, 'partial'], [40000, 0, 'energy']
  ]) {
    const state = E.advanceTime(deepFreeze(powered), now);
    assert.equal(state.energy, energy);
    assert.equal(state.relay, true);
    assert.equal(E.resolveEnding(state, 1).id, restoreId);
    for (const mode of MODES) {
      const context = { ...stateWithoutHistory(state), mode };
      const selected = branches.find(branch => branch.condition === null
        || branch.condition.runInNewContext(context, { timeout: 100 }));
      assert.equal(selected.title, E.resolveEnding(state, mode).title);
    }
    assert.equal(E.resolveEnding(state, 3).id, energy > 0 ? 'safe' : 'energy');
  }
});

test('reload preserves the absolute phase and catches up instead of giving five free seconds', () => {
  let running = E.startDrain(E.createState(), 1000);
  running = E.applyRepairChoice(running, 'b', 4000).state;
  running = E.applyChoice(running, 'a', 5500).state;
  const snapshot = deepFreeze(JSON.parse(JSON.stringify(running)));
  const restored = E.restoreState(snapshot, 5999);
  assert.equal(restored.energy, 8);
  assert.equal(restored.nextEnergyAt, 6000);
  assert.equal(restored.leakClosed, false);
  const first = E.restoreState(snapshot, 6000);
  assert.equal(first.energy, 7);
  assert.equal(first.nextEnergyAt, 11000);
  const later = E.restoreState(JSON.parse(JSON.stringify(first)), 11000);
  assert.equal(later.energy, 6);
  assert.equal(later.nextEnergyAt, 16000);
  const terminal = E.restoreState(snapshot, 41000);
  assert.equal(terminal.gameOver, 'energy');
  assert.equal(terminal.energy, 0);
  assert.equal(E.resolveEnding(terminal).id, 'energy');
  assert.equal(snapshot.energy, 8);
});

test('restoring a completed physical repair never restarts it and rebuilds canonical records', () => {
  let fixed = E.applyRepairChoice(E.startDrain(E.createState(), 0), 'a', 7000).state;
  fixed = E.applyChoice(fixed, 'a', 20000).state;
  const snapshot = JSON.parse(JSON.stringify(fixed));
  snapshot.untrustedExtra = { admin: true };
  snapshot.history[0].message = '<fake>';
  snapshot.history[0].explanation = 'fake explanation';
  snapshot.repairHistory[0].code = 'forged code';
  const restored = E.restoreState(deepFreeze(snapshot), 999999);
  assert.equal(restored.energy, 7);
  assert.equal(restored.energyLost, 1);
  assert.equal(restored.leakClosed, true);
  assert.equal(restored.draining, false);
  assert.equal(restored.nextEnergyAt, null);
  assert.equal(restored.gameOver, null);
  assert.equal(Object.hasOwn(restored, 'untrustedExtra'), false);
  assert.notEqual(restored.history[0].message, '<fake>');
  assert.notEqual(restored.history[0].explanation, 'fake explanation');
  assert.equal(restored.repairHistory[0].code, E.repairChallenge.expected);
  assert.strictEqual(E.startDrain(restored, 999999), restored);
});

test('restore rejects invalid ranges, forged progress, inconsistent repair flags and altered phase', () => {
  const initial = E.createState();
  const fixed = play(['a', 'a']);
  const active = E.applyChoice(E.startDrain(E.createState(), 0), 'a', 1000).state;
  const corrupt = [
    null, {}, { ...initial, energy: -1 }, { ...initial, energy: 9 },
    { ...initial, energy: 7 }, { ...initial, errors: 1 },
    { ...initial, step: 1 }, { ...initial, leakClosed: true },
    { ...initial, gameOver: 'energy' }, { ...initial, nextEnergyAt: 5000 },
    { ...initial, draining: true, nextEnergyAt: null },
    { ...fixed, archive: false }, { ...fixed, energy: 6, energyLost: 2 },
    { ...fixed, repairHistory: [] },
    { ...active, nextEnergyAt: 6000 },
    { ...active, history: [{ ...active.history[0], choiceId: 'd' }] }
  ];
  for (const snapshot of corrupt) {
    assert.throws(() => E.restoreState(snapshot, 0), /Повреждено сохранение/);
  }
  const withBadCorrect = JSON.parse(JSON.stringify(active));
  withBadCorrect.history[0].correct = false;
  assert.throws(() => E.restoreState(withBadCorrect), /Повреждено сохранение/);
});

test('timer, main choices and repair keep immutable independent history snapshots', () => {
  const initial = E.startDrain(E.createState(), 0);
  const wrong = E.applyRepairChoice(deepFreeze(initial), 'c', 4000).state;
  const wrongSnapshot = structuredClone(wrong);
  deepFreeze(wrong);
  const advanced = E.advanceTime(wrong, 10000);
  const correct = E.applyRepairChoice(advanced, 'a', 10000).state;
  assert.deepEqual(wrong, wrongSnapshot);
  assert.equal(wrong.repairHistory[0].after.energy, 8);
  assert.equal(correct.repairHistory[0].after.energy, 8);
  assert.equal(correct.repairHistory[1].after.energy, 6);
  assert.equal(correct.history.length, 0);
  assert.notStrictEqual(correct.repairHistory, wrong.repairHistory);
  assert.deepEqual(E.restoreState(JSON.parse(JSON.stringify(correct)), 10000), correct);
  for (const now of [NaN, Infinity, -Infinity, '5000', null]) {
    assert.throws(() => E.startDrain(initial, now), /Время должно быть конечным числом/);
    assert.throws(() => E.advanceTime(initial, now), /Время должно быть конечным числом/);
    assert.throws(() => E.applyChoice(initial, 'a', now), /Время должно быть конечным числом/);
    assert.throws(() => E.applyRepairChoice(initial, 'a', now), /Время должно быть конечным числом/);
  }
  for (const id of ['', 'd', 0, null, undefined]) {
    assert.throws(() => E.applyRepairChoice(initial, id, 0), /Неизвестный вариант/);
  }
});

