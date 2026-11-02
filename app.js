(() => {
  'use strict';
  const E=window.ProtocolEngine, KEY='zero-protocol-single-leak-v4';
  const $=s=>document.querySelector(s), escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=E.createState(),started=false,view='home',resumeView='repair',feedback=null,repairFeedback=null,ending=null,discovered=[],storageWarning=false,lastEnergyUiKey='';
  try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved){
    discovered=Array.isArray(saved.discovered)?saved.discovered.filter(id=>E.endings.some(e=>e.id===id)):[];
    state=E.restoreState(saved.state,Date.now());started=!!saved.started;
    view=['home','game','repair','guide','endings'].includes(saved.view)?saved.view:started?'game':'home';
    resumeView=saved.resumeView==='repair'?'repair':'game';
    feedback=saved.feedback&&state.history.length?{...state.history.at(-1)}:null;
    repairFeedback=state.repairHistory.length?{...state.repairHistory.at(-1)}:null;
    if(!started){state=E.createState();view='home';feedback=null;repairFeedback=null;}
    else if(state.gameOver==='energy'){ending=E.resolveEnding(state);view='game';feedback=null;repairFeedback=null;if(!discovered.includes(ending.id))discovered.push(ending.id);}
    else if([1,2,3].includes(state.mode)&&state.step===5)ending=E.resolveEnding(state,state.mode);
    if(view==='repair'&&!state.repairAvailable&&!state.leakClosed)view='game';
  }}catch(_){state=E.createState();started=false;view='home';storageWarning=true;}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({state,started,view,resumeView,discovered,feedback:!!feedback}));}catch(_){storageWarning=true;}};
  function secondsToEnergyLoss(now=Date.now()){
  return state.draining&&state.nextEnergyAt!==null?Math.max(0,Math.ceil((state.nextEnergyAt-now)/1000)):null;
}
  function terminalNotice(){
  if(state.leakClosed)return '<strong>Утечка устранена</strong><p>Клапан перекрыт и проверен. На остальных этапах разряда больше не будет.</p>';
  if(view==='repair'&&repairFeedback)return '<strong>Утечка продолжается</strong><p>Этот алгоритм не закрыл клапан. Можно выбрать другой вариант, пока ты ещё здесь, или уйти без ремонта.</p>';
  if(view==='repair')return '<strong>Обнаружена утечка энергии</strong><p>Это отдельный аварийный алгоритм. Исправь его сейчас или продолжай путь с открытой утечкой. Вернуться к ремонту позже нельзя.</p>';
  return '<strong>Утечка энергии активна</strong><p>Она не устранена в начале пути. Обычные задания не останавливают разряд, а ремонтный терминал уже недоступен.</p>';
}
  function updateLumaStatus(){
  const status=$('.sidebar-bottom');if(!status)return;
  const offline=state.gameOver==='energy'||ending?.id==='energy';
  const content=offline?'<span class="online-dot"></span> ЛУМА НЕ НА СВЯЗИ':'<span class="online-dot"></span> ЛУМА НА СВЯЗИ<p>Любое будущее начинается<br>с одного условия.</p>';
  status.classList.toggle('offline',offline);if(status.innerHTML!==content)status.innerHTML=content;
}
  function updateEnergyUi(){
  const key=[state.energy,state.draining,state.leakClosed,state.errors,state.relay,state.archive,secondsToEnergyLoss(),view].join(':');
  if(key===lastEnergyUiKey)return;lastEnergyUiKey=key;
  const hud=$('.stats');if(hud)hud.outerHTML=stats();
  if(view==='game'&&!feedback&&state.step<E.challenges.length){const challenge=E.getChallenge(state),facts=$('.facts');if(facts&&challenge){const content=typeof challenge.facts==='function'?challenge.facts(state):challenge.facts;if(facts.textContent!==content)facts.textContent=content;}}
  const notice=$('.terminal-notice');if(notice){const content=terminalNotice();if(notice.innerHTML!==content)notice.innerHTML=content;}
}
  function finishEnergyLoss(){
  ending=E.resolveEnding(state);feedback=null;repairFeedback=null;view='game';resumeView='game';
  if(!discovered.includes(ending.id))discovered.push(ending.id);save();
}
  function syncEnergy(now=Date.now(),paint=true){
  if(!started||ending)return false;
  const next=E.advanceTime(state,now);if(next!==state){state=next;save();}
  if(state.gameOver==='energy'){finishEnergyLoss();if(paint)render(true);return true;}
  if(paint)updateEnergyUi();return false;
}
  const chapterNames=['Шлюз','Архив','Реле','Мост','Тревога','Ядро'];
  function cityArt(color='#B9F568') {
    return `<svg class="city-art" viewBox="0 0 520 480" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="ground" x2="0" y2="1"><stop stop-color="#252E45"/><stop offset="1" stop-color="#101525"/></linearGradient><linearGradient id="tower" x2="1" y2="0"><stop stop-color="#353D53"/><stop offset=".5" stop-color="#7D89AA"/><stop offset="1" stop-color="#252E45"/></linearGradient><radialGradient id="glow"><stop stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><pattern id="windows" width="17" height="21" patternUnits="userSpaceOnUse"><rect x="4" y="5" width="3" height="6" fill="${color}" opacity=".55"/></pattern></defs><circle cx="285" cy="185" r="175" fill="url(#glow)"/><circle cx="285" cy="180" r="108" fill="none" stroke="#A9A2FF" stroke-opacity=".2" stroke-dasharray="2 9"/><circle cx="285" cy="180" r="79" fill="none" stroke="#A9A2FF" stroke-opacity=".15"/><path d="M0 350L520 350M0 390L520 390M0 440L520 440M50 480L230 330M155 480L250 330M300 480L270 330M450 480L290 330" stroke="#A9A2FF" stroke-opacity=".23" fill="none"/><path d="M0 340L80 296L150 320L240 278L340 306L410 280L520 324L520 480L0 480Z" fill="url(#ground)"/><g stroke="#65718F" stroke-width="1"><path d="M25 333V242L74 220L104 237V333L56 355Z" fill="#181F33"/><path d="M25 242L56 260L104 237M56 260V355" fill="none"/><path d="M113 332V278L149 260L184 280V332L149 350Z" fill="#252E45"/><path d="M113 278L149 297L184 280M149 297V350" fill="none"/><path d="M335 342V237L381 211L420 235V342L377 365Z" fill="#252E45"/><path d="M335 237L377 260L420 235M377 260V365" fill="none"/><path d="M423 360V285L461 265L495 282V360L458 381Z" fill="#181F33"/><path d="M423 285L458 305L495 282M458 305V381" fill="none"/></g><g fill="url(#windows)"><path d="M31 250L51 262V339L31 328Z"/><path d="M64 268L96 249V324L64 343Z"/><path d="M343 246L370 262V345L343 329Z"/><path d="M384 266L411 248V331L384 347Z"/><path d="M432 294L452 306V360L432 348Z"/></g><path d="M210 337V174L264 143L316 174V337L264 367Z" fill="url(#tower)" stroke="#A9A2FF"/><path d="M210 174L264 205L316 174M264 205V367" fill="none" stroke="#B4BCD0"/><path d="M230 163V122L265 101L296 121V162L265 181Z" fill="#596782" stroke="#B4BCD0"/><path d="M230 122L265 141L296 121M265 141V181" fill="none" stroke="#B4BCD0"/><path d="M265 54V105" stroke="${color}"/><circle cx="265" cy="54" r="4" fill="${color}"/><path d="M223 213L251 230V242L223 226ZM223 249L251 266V278L223 262ZM223 285L251 302V314L223 298ZM278 229L303 215V229L278 244ZM278 266L303 252V266L278 281ZM278 303L303 289V303L278 318Z" fill="${color}" opacity=".75"/><path d="M0 380L88 329L149 365L211 329M316 329L378 365L465 415L520 383" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/><path d="M10 390L88 345L149 381L211 345M316 345L378 381L465 431L520 399" fill="none" stroke="#A9A2FF" opacity=".35"/><circle cx="149" cy="365" r="4" fill="${color}"/><circle cx="378" cy="365" r="4" fill="${color}"/><g fill="#A9A2FF" opacity=".6"><circle cx="120" cy="110" r="1"/><circle cx="393" cy="130" r="1.3"/><circle cx="183" cy="76" r="1"/><circle cx="370" cy="62" r="1"/><circle cx="66" cy="161" r="1"/><circle cx="463" cy="194" r="1"/></g></svg>`;
  }
  function visual(label,small=false,color){return `<div class="${small?'scene-visual':'hero-visual'}"><div class="visual-label"><span class="online-dot"></span>${escape(label)}</div>${cityArt(color)}${small?'':'<div class="visual-frame"><span>if</span></div>'}</div>`;}
  const button=(text,action,type='primary')=>`<button class="button ${type}" data-action="${action}">${text}</button>`;
  function stats(){
  const seconds=secondsToEnergyLoss();
  const status=state.energy===0?'Энергия потеряна':state.leakClosed?'Заряд стабилен':state.draining?'Утечка: −1 через '+seconds+' с':'Разряд остановлен';
  const bars=Array.from({length:E.MAX_ENERGY},(_,i)=>`<span class="energy-cell ${i<state.energy?'filled':''}" aria-hidden="true"></span>`).join('');
  return `<div class="stats" aria-label="Состояние города"><div class="energy-stat"><span>ЭНЕРГИЯ</span><span class="energy-cells" role="img" aria-label="${state.energy} из ${E.MAX_ENERGY} делений">${bars}</span><strong class="energy-value">${state.energy}/${E.MAX_ENERGY}</strong></div><div class="stats-systems"><span>ОШИБКИ <b>${state.errors}</b></span><span>РЕЛЕ <b>${state.relay?'ВКЛ':'ВЫКЛ'}</b></span><span>АРХИВ <b>${state.archive?'ОТКРЫТ':'ЗАКРЫТ'}</b></span></div><p class="energy-status ${state.energy===0?'empty':state.draining?'leaking':'stable'}" aria-live="off">${status}</p></div>`;
}
  function sectionTop(eyebrow,title,step){return `<div class="section-top"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${step!==undefined?`<div class="progress-caption">ЭТАП ${step+1} ИЗ 6<div class="progress-bar">${Array.from({length:6},(_,i)=>`<span class="${i<=step?'filled':''}"></span>`).join('')}</div></div>`:''}</div>`;}
  function cover(){
  const label=ending?'Начать заново':started?'Продолжить историю':'Начать историю';
  const action=ending?'restart':started?'resume':'start';
  return `${started&&!ending?stats():''}<section class="hero"><div class="hero-text"><h1>Город уснул. Твой выбор — <em>его будущее.</em></h1><p class="lead">Центральное Ядро потеряло правила. Восстанови их, выбирая условия в коде, и узнай, каким будет рассвет.</p><div class="hero-actions">${button(label+' <span class="play-icon" aria-hidden="true">▶</span>',action)}</div></div>${visual('КРИТИЧЕСКИЙ СБОЙ / ОЖИДАНИЕ ОПЕРАТОРА')}</section>${storageWarning?'<p class="notice">Сохранение в этом браузере недоступно. Текущая игра работает до закрытия вкладки.</p>':''}`;
}
  function repairPage(){
  const c=E.repairChallenge;
  return `${sectionTop('Аварийный терминал','Устрани утечку энергии')}${stats()}<section class="mission-grid"><div>${visual('РЕЗЕРВНАЯ ЛИНИЯ / АВАРИЙНЫЙ КЛАПАН',true)}<p class="story-text">${escape(c.story)}</p><div class="luma"><span class="luma-label">Лума</span>${escape(c.quote)}</div></div><div class="task-panel ${state.leakClosed?'sealed':'leaking'}"><div class="task-top"><span>АВАРИЙНЫЙ ТЕРМИНАЛ</span><span>PASCAL</span></div><div class="terminal-notice ${state.leakClosed?'sealed':'leaking'}" role="status">${terminalNotice()}</div><h2>${escape(c.task)}</h2><pre class="facts">${escape(c.facts)}</pre><div class="choices">${c.choices.map((choice,i)=>`<button class="choice ${state.leakClosed?(choice.correct?'correct':'dimmed'):repairFeedback?.choiceId===choice.id?'incorrect':''}" data-repair-choice="${choice.id}" ${state.leakClosed?'disabled':''}><span class="choice-index">${state.leakClosed&&choice.correct?'✓':repairFeedback?.choiceId===choice.id?'×':i+1}</span><code>${escape(choice.code)}</code></button>`).join('')}</div>${repairFeedback?`<div class="feedback ${repairFeedback.correct?'':'wrong'}" role="status"><h3>${repairFeedback.correct?'Ремонт завершён':'Клапан остаётся открыт'}</h3><p>${escape(repairFeedback.message)}</p><details><summary>Разбор алгоритма</summary><p>${escape(repairFeedback.explanation)}</p></details></div>`:''}<p class="hint">${state.leakClosed?'Запас энергии сохранится на всём оставшемся пути.':'Выбери код или нажми 1, 2, 3. После перехода к маршруту ремонт станет недоступен.'}</p><div class="repair-actions">${button(state.leakClosed?'К основным заданиям <span>→</span>':'Продолжить путь без ремонта <span>→</span>','leave-repair',state.leakClosed?'primary':'secondary')}</div></div></section>`;
}
  function mission(){
  const index=feedback?state.step-1:state.step,c=E.challenges[index],facts=typeof c.facts==='function'?c.facts(feedback?feedback.before:state):c.facts;
  return `${sectionTop(`${c.location} / ${c.concept}`,c.title,index)}${stats()}<section class="mission-grid"><div>${visual(`СЕКТОР 0${index+1} / ${c.location.toUpperCase()}`,true)}<p class="story-text">${escape(c.story)}</p><div class="luma"><span class="luma-label">Лума</span>${escape(c.quote)}</div></div><div class="task-panel ${state.leakClosed?'':'leaking'}"><div class="task-top"><span>ТЕРМИНАЛ ОПЕРАТОРА</span><span>PASCAL</span></div>${state.leakClosed?'':`<div class="terminal-notice leaking" role="status">${terminalNotice()}</div>`}<h2>${escape(c.task)}</h2><pre class="facts">${escape(facts)}</pre><div class="choices">${c.choices.map((choice,i)=>`<button class="choice ${feedback?(choice.correct?'correct':choice.id===feedback.choiceId?'incorrect':'dimmed'):''}" data-choice="${choice.id}" ${feedback?'disabled':''}><span class="choice-index">${feedback&&choice.correct?'✓':feedback&&choice.id===feedback.choiceId?'×':i+1}</span><code>${escape(choice.code)}</code></button>`).join('')}</div>${feedback?`<div class="feedback ${feedback.correct?'':'wrong'}" role="status"><h3>${feedback.correct?'Правило выбрано верно':'Выбранное правило не подходит'}</h3><p>${escape(feedback.message)}</p><p class="explanation">${escape(feedback.explanation||c.explanation)}</p><details><summary>Правильный алгоритм</summary><pre class="code-block">${escape(c.expected)}</pre></details>${button(state.step===5?'К финальному выбору <span>→</span>':'Следующая локация <span>→</span>','next')}</div>`:'<p class="hint">Выбери вариант или нажми 1, 2, 3.<br>Одно решение на этап. Обычные задания не меняют состояние утечки.</p>'}</div></section>`;
}
  function stateList(){return `<div class="state-list"><div>energy<span>${state.energy}</span></div><div>leakClosed<span>${state.leakClosed}</span></div><div>errors<span>${state.errors}</span></div><div>archive<span>${state.archive}</span></div><div>relay<span>${state.relay}</span></div><div>bridge<span>${state.bridge}</span></div><div>trust<span>${state.trust}</span></div></div>`;}
  function finalChoice(){
  return `${sectionTop('Башня Ядра / case ... of','Последняя команда',5)}${stats()}<section class="final-grid"><div>${visual('ЯДРО / ОЖИДАНИЕ КОМАНДЫ',true)}<p class="story-text">Все пять решений уже записаны. Ты стоишь у центрального терминала. Можно восстановить город, доверить системы Луме или безопасно остановить Ядро.</p><div class="luma"><span class="luma-label">Лума</span>Теперь выбор определяет режим работы. Но состояние систем тоже имеет значение: я не смогу включить то, что осталось без питания.</div>${stateList()}</div><div><h2>Выбери режим</h2><p class="lead">Целое число <code>mode</code> попадёт в алгоритм на Pascal.</p><div class="final-options"><button class="final-option" data-mode="1"><strong>Восстановить город <span>↗</span></strong><small>Вернуть управление людям и запустить готовые системы.</small><code>mode := 1;</code></button><button class="final-option" data-mode="2"><strong>Передать управление Луме <span>↗</span></strong><small>Включить автономию, если осталась энергия, реле работает и ошибок меньше трёх.</small><code>mode := 2;</code></button><button class="final-option" data-mode="3"><strong>Безопасно остановить Ядро <span>↗</span></strong><small>Сохранить журнал и перейти на ручное управление.</small><code>mode := 3;</code></button></div><details class="notice"><summary>Как работает case в Pascal</summary><pre class="code-block">case mode of
  1: action := 'Восстановить';
  2: action := 'Автономия';
  3: action := 'Остановить';
end;</pre><p>case выбирает действие по значению mode. В Pascal перехода к следующему варианту нет, поэтому break не нужен. Затем if ... then ... else проверяет состояние города и определяет концовку.</p></details></div></section>`;
}
  function highlightedFinal(){const groups=[[0,1],[2,3],[4,5],[6,7],[8,9,10],[11,12]],active=groups[ending.branchIndex];return `<pre class="code-block" aria-label="Алгоритм выбора концовки">${E.FINAL_CODE.split('\n').map((line,i)=>`<span class="code-line ${active.includes(i)?'executed':''}">${escape(line)}</span>`).join('')}</pre>`;}
  function journal(){
  const repairs=state.repairHistory.map((r,i)=>`<details><summary>Ремонт / попытка ${i+1}<span class="result-flag ${r.correct?'':'bad'}">${r.correct?'УСТРАНЕНА':'НЕ УСТРАНЕНА'}</span></summary><pre class="code-block">${escape(r.code)}</pre><p>${escape(r.explanation)}</p></details>`).join('');
  const decisions=state.history.map((r,i)=>`<details><summary>${i+1} / ${E.challenges[i].title}<span class="result-flag ${r.correct?'':'bad'}">${r.correct?'ВЕРНО':'ОШИБКА'}</span></summary><p>Твой выбор:</p><pre class="code-block">${escape(r.code)}</pre><p>${escape(r.explanation||E.challenges[i].explanation)}</p><p>Правильная запись:</p><pre class="code-block">${escape(r.expectedCode)}</pre></details>`).join('');
  return `<section class="journal"><h2>Твой алгоритм: журнал решений</h2>${repairs}${decisions||'<p class="micro">Основные задания не завершены.</p>'}</section>`;
}
  function endingPage(){
  const n=E.endings.findIndex(e=>e.id===ending.id)+1;
  return `<section class="ending-layout" style="--accent:${ending.color}"><div><p class="ending-number">КОНЦОВКА ${n} / ${E.endings.length}</p><h1>${ending.title}</h1><p class="ending-subtitle">${ending.subtitle}</p><div class="ending-prose">${ending.text.map(p=>`<p>${escape(p)}</p>`).join('')}</div><div class="hero-actions">${button('Сыграть ещё раз <span>↻</span>','restart')}${button('Другие концовки','collection','secondary')}</div></div><div>${visual('РАССВЕТ / ЖУРНАЛ ЗАКРЫТ',true,ending.color)}${highlightedFinal()}${stateList()}</div></section>${journal()}`;
}
  function guide(){
  return `${sectionTop('Справочник оператора / Pascal','Алгоритмы и условия')}<p class="guide-intro">Все задания и примеры написаны на Pascal. Ты выбираешь готовое условие или алгоритм, а игра показывает его смысл на конкретных данных. Отдельная консольная версия на Pascal входит в комплект.</p><section class="guide-grid"><article class="guide-item"><h2>Алгоритм</h2><p>Точная последовательность команд для решения задачи. Сначала собираем данные, затем проверяем результат. В Pascal процедуры без параметров можно вызывать по имени.</p><pre class="code-block">Scan;
if Check then
  Cross;</pre></article><article class="guide-item"><h2>Сравнение и присваивание</h2><p>Условие имеет тип <code>Boolean</code> и принимает значение <code>true</code> или <code>false</code>. Знак <code>=</code> сравнивает, а <code>:=</code> присваивает значение. Знак <code>&lt;&gt;</code> означает «не равно».</p><pre class="code-block">energy := 3;
3 >= 2  { true }
3 > 3   { false }
3 = 2   { false }
3 &lt;&gt; 2  { true }</pre></article><article class="guide-item"><h2>Полное ветвление</h2><p><code>if ... then ... else</code> выполняет одну из двух ветвей. При истинном условии выполняется команда после <code>then</code>, при ложном — после <code>else</code>. Перед <code>else</code> точку с запятой не ставят.</p><pre class="code-block">if warning then
  Evacuate
else
  ContinueWork;</pre></article><article class="guide-item"><h2>Неполное ветвление и блок</h2><p>Без <code>else</code> программа при ложном условии пропускает действие. Несколько команд объединяют в составной оператор <code>begin ... end</code>.</p><pre class="code-block">if hasPass then
begin
  OpenGate;
  WriteLn('Доступ разрешён');
end;
ShowStatus;</pre></article><article class="guide-item"><h2>and, or, not</h2><p><code>and</code> требует оба условия. <code>or</code> допускает хотя бы одно. <code>not</code> инвертирует логическое значение. Сравнения внутри составного условия заключаем в скобки: <code>(energy >= 2) and coolant</code>.</p><table class="truth-table"><thead><tr><th>A</th><th>B</th><th>A and B</th><th>A or B</th></tr></thead><tbody><tr><td>true</td><td>true</td><td>true</td><td>true</td></tr><tr><td>true</td><td>false</td><td>false</td><td>true</td></tr><tr><td>false</td><td>true</td><td>false</td><td>true</td></tr><tr><td>false</td><td>false</td><td>false</td><td>false</td></tr></tbody></table><p><code>not true = false</code>, <code>not false = true</code></p></article><article class="guide-item"><h2>Выбор по значению: case</h2><p><code>case ... of</code> выбирает вариант по значению переменной целого, символьного или другого порядкового типа. В игре <code>mode</code> — целое число от 1 до 3.</p><pre class="code-block">case mode of
  1: action := 'Восстановить';
  2: action := 'Автономия';
  3: action := 'Остановить';
else
  action := 'Неизвестный режим';
end;</pre></article><article class="guide-item"><h2>Порядок проверок</h2><p>В цепочке <code>else if</code> первая истинная проверка выбирает действие. Дальнейшие ветви пропускаются. Остановка в финале имеет приоритет над состоянием систем.</p><pre class="code-block">if mode = 3 then
  ending := 'Аварийный рассвет'
else if (errors >= 3) or (not relay) then
  ending := 'Город в паузе';</pre></article><article class="guide-item"><h2>Состояние связывает сцены</h2><p>Правильность выбора меняет переменные. Тип <code>Integer</code> хранит энергию и ошибки. Тип <code>Boolean</code> хранит готовность систем. Начальные значения задают перед первым заданием.</p><pre class="code-block">var
  energy, errors: Integer;
  archive, relay: Boolean;
begin
  energy := 8;
  errors := 0;
  archive := false;
  relay := false;
end.</pre></article></section><div class="back-action">${button('Вернуться в игру <span>→</span>','game')}</div>`;
}
  function collection(){return `${sectionTop('Разные истории',`${E.endings.length} вариантов рассвета`)}<p class="collection-caption">ОТКРЫТО ${discovered.length} ИЗ ${E.endings.length} КОНЦОВОК</p><section class="endings-grid">${E.endings.map((e,i)=>`<article class="ending-entry ${discovered.includes(e.id)?'':'locked'}"><p class="ending-tag">${i+1} / ${discovered.includes(e.id)?'✓ НАЙДЕНА':'ЕЩЁ НЕ НАЙДЕНА'}</p><h2>${e.title}</h2><p>${e.subtitle}</p></article>`).join('')}</section><div class="back-action">${button(ending?'Вернуться к финалу <span>→</span>':'Продолжить историю <span>→</span>','game')}</div>`;}
  function render(focus=false){
  syncEnergy(Date.now(),false);
  $('#route').innerHTML=chapterNames.map((name,i)=>`<li aria-label="Этап ${i+1}: ${name}" class="${started?(i<state.step?'done':i===(feedback?state.step-1:state.step)?'active':''):i===0?'active':''}"><span class="route-number">${i+1}</span><span>${name}</span></li>`).join('');
  $('#main').innerHTML=view==='home'?cover():view==='guide'?guide():view==='endings'?collection():!started?cover():ending?endingPage():view==='repair'?repairPage():state.step===5&&!feedback?finalChoice():mission();
  lastEnergyUiKey='';updateEnergyUi();updateLumaStatus();
  document.title=ending&&view==='game'?ending.title+' — Нулевой протокол':'Нулевой протокол — алгоритм твоего выбора';
  if(focus){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
  function restart(){state=E.startDrain(E.createState(),Date.now());started=true;feedback=null;repairFeedback=null;ending=null;view='repair';resumeView='repair';save();render(true);}
  function handleClick(event){
  const target=event.target.closest('button,a.brand');if(!target)return;
  const now=Date.now();if(syncEnergy(now,false)){render(true);return;}
  if(target.matches('.brand')){event.preventDefault();if(view!=='home')resumeView=view==='repair'?'repair':'game';view='home';save();render(true);return;}
  if(target.dataset.repairChoice&&view==='repair'&&started&&!ending&&!state.leakClosed&&state.repairAvailable){const result=E.applyRepairChoice(state,target.dataset.repairChoice,now);state=result.state;repairFeedback=result.result;save();render();return;}
  if(target.dataset.choice&&!feedback&&view==='game'&&started&&!ending){const result=E.applyChoice(state,target.dataset.choice,now);state=result.state;feedback=result.result;save();render();$('.feedback')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});return;}
  if(target.dataset.mode&&state.step===5&&!feedback&&!ending){const mode=Number(target.dataset.mode);state={...E.stopDrain(state),mode};ending=E.resolveEnding(state,mode);if(!discovered.includes(ending.id))discovered.push(ending.id);save();render(true);return;}
  switch(target.dataset.action){
    case 'start':restart();break;
    case 'resume':view=resumeView==='repair'&&(state.repairAvailable||state.leakClosed&&state.step===0)?'repair':'game';save();render(true);break;
    case 'leave-repair':state=E.leaveRepair(state);view='game';resumeView='game';save();render(true);break;
    case 'next':feedback=null;view='game';save();render(true);break;
    case 'restart':restart();break;
    case 'collection':view='endings';save();render(true);break;
    case 'game':view='game';save();render(true);break;
  }
}
  document.addEventListener('click',handleClick);
  document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||!started||ending)return;if(!['1','2','3'].includes(event.key)||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;const selector=view==='repair'&&state.repairAvailable?'[data-repair-choice]':view==='game'&&!feedback&&state.step<5?'[data-choice]':null;if(selector){event.preventDefault();document.querySelectorAll(selector)[Number(event.key)-1]?.click();}});
  window.setInterval(()=>syncEnergy(),250);
  window.addEventListener('focus',()=>syncEnergy());
  document.addEventListener('visibilitychange',()=>syncEnergy());
  window.addEventListener('pagehide',()=>{syncEnergy(Date.now(),false);if(started)save();});
  render();
  if(started)save();
})();
