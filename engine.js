(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProtocolEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const MAX_ENERGY = 8;
  const DRAIN_INTERVAL_MS = 5000;
  const repairChallenge = {
    id:'repair',title:'Утечка в резервной линии',location:'Аварийный клапан',concept:'Ремонт алгоритмом',
    story:'Запас города — восемь единиц энергии. В резервной линии открыта одна общая утечка: каждые пять секунд исчезает единица. Можно устранить её сейчас или уйти в маршрут без ремонта. После ухода вернуться к клапану нельзя. Неустранённая утечка продолжается на всех этапах, а при нулевом заряде история сразу закончится.',
    quote:'Датчик и отметка на экране описывают систему. Подумай, какое действие действительно изменит её состояние.',
    task:'При обнаруженной утечке закрой клапан. Только после проверки герметичности отметь ремонт завершённым.',
    facts:'leakDetected = true\nCloseValve — закрыть физический клапан\nIsSealed — проверить герметичность после CloseValve',
    choices:[
      {id:'b',code:'if not leakDetected then\n  CloseValve;',correct:false},
      {id:'a',code:'if leakDetected then\nbegin\n  CloseValve;\n  if IsSealed then\n    leakClosed := true;\nend;',correct:true},
      {id:'c',code:'leakClosed := true;',correct:false}
    ],
    expected:'if leakDetected then\nbegin\n  CloseValve;\n  if IsSealed then\n    leakClosed := true;\nend;',
    explanation:'При leakDetected = true выполняется блок then. CloseValve сначала закрывает клапан, затем IsSealed проверяет результат. В этой задаче исправный клапан после закрытия герметичен, поэтому leakClosed становится true. Проверка not leakDetected пропустит ремонт. Одно присваивание флагу не закрывает физический клапан. begin и end объединяют действия в блок.',
    success:'Клапан закрыт, герметичность подтверждена. Общая утечка устранена навсегда: на остальных этапах энергия больше не убывает.',
    failure:'Физический ремонт не выполнен. Утечка продолжается с прежним отсчётом. Можно попробовать другой алгоритм, пока остаёшься здесь, или уйти без ремонта. После ухода вернуться нельзя.'
  };
  const challenges = [
    {id:'gate', title:'Шлюз на границе', location:'Южная станция', concept:'Сравнение',
      story:'В 04:17 город Ветвление замолчал. Поезда остановились, окна погасли, а центральное Ядро потеряло правила выбора. Ты — стажёр-оператор. В начале смены в резерве было восемь единиц энергии. Общую утечку можно было закрыть отдельным алгоритмом перед выходом в маршрут. Если ремонт пропущен, она отнимает единицу каждые пять секунд. Обычные задания её не устраняют.',
      quote:'Время уходит, но поспешный выбор тоже оставляет след. Сверь правило с показаниями терминала.',
      task:'Выбери условие «энергии не меньше 2».', facts:s=>'energy = '+s.energy,
      choices:[{id:'a',label:'Энергии достаточно',code:'energy >= 2',correct:true},{id:'b',label:'Энергии больше трёх',code:'energy > 3',correct:false},{id:'c',label:'Энергии ровно две',code:'energy = 2',correct:false}],
      expected:'if energy >= 2 then\n  OpenGate;',
      explanation:'«Не меньше 2» означает 2 или любое большее число. Поэтому нужен оператор >=. Например, energy > 3 при энергии 8 тоже даёт true, но при 2 или 3 ошибочно запретит открытие. Мы выбираем правило для всех допустимых значений, а не только выражение с результатом true сейчас. Значение самого условия зависит от энергии в момент выбора.',
      success:'Створки расходятся, и ты проходишь к архиву. Правило шлюза восстановлено.',
      failure:'Правило шлюза выбрано неверно. Лума открывает аварийный проход, а ошибка остаётся в журнале.'},
    {id:'archive',title:'Забытый пароль',location:'Городской архив',concept:'Логическое ИЛИ',
      story:'В архиве хранятся маршруты, имена улиц и резервная копия города. Пропуск потерян, но Лума помнит код. Система разрешает доступ по пропуску ИЛИ по коду: достаточно одного доказательства.',
      quote:'У архива свои правила доступа. Проверь, какой из вариантов им соответствует.',
      task:'Открой архив, если есть пропуск ИЛИ известен код.',facts:'hasPass = false\nknowsCode = true',
      choices:[{id:'a',label:'Достаточно одного способа',code:'hasPass or knowsCode',correct:true},{id:'b',label:'Требуются оба способа',code:'hasPass and knowsCode',correct:false},{id:'c',label:'Код должен быть неизвестен',code:'not knowsCode',correct:false}],
      expected:'if hasPass or knowsCode then\n  archive := true;',
      explanation:'Оператор or (ИЛИ) даёт true, когда истинно хотя бы одно условие. Здесь false or true = true. Оператор and потребовал бы и пропуск, и код. Оператор not меняет true на false и наоборот.',
      success:'Архив узнаёт голос Лумы. Сотни забытых адресов возвращаются на карту. Резервная копия доступна.',
      failure:'Архив остаётся закрыт. Путь к Ядру есть и без него, но часть памяти города пока потеряна.'},
    {id:'relay',title:'Цена одного И',location:'Энергетический узел',concept:'Логическое И',
      story:'Реле питает центральное Ядро. Для безопасного запуска одновременно нужны заряд не меньше двух и рабочее охлаждение. Один исправный датчик не может заменить другой.',
      quote:'Узлу нужно надёжное правило, которое выдержит изменение показаний датчиков.',
      task:'Запусти реле, только если хватает энергии И работает охлаждение.',facts:s=>'energy = '+s.energy+'\ncoolant = true',
      choices:[{id:'a',label:'Оба требования обязательны',code:'(energy >= 2) and coolant',correct:true},{id:'b',label:'Достаточно одного требования',code:'(energy >= 2) or coolant',correct:false},{id:'c',label:'Охлаждение должно быть выключено',code:'(energy >= 2) and (not coolant)',correct:false}],
      expected:'if (energy >= 2) and coolant then\n  relay := true;',
      explanation:'Оператор and (И) требует, чтобы оба условия были истинны. Сравнение energy >= 2 заключаем в скобки перед and. В этой сцене and и or могут оба дать true. Но при energy = 1 и coolant = true выражение с or всё ещё запустило бы реле. Поэтому оцениваем верность правила, а не случайное совпадение результата.',
      success:'Реле проходит проверку. Гул возвращается в подземные кабели. Ядро снова может получать питание.',
      failure:'Защитный контроллер отклоняет опасное правило. Реле остаётся выключенным, и полноценный перезапуск станет невозможен.'},
    {id:'bridge',title:'Порядок имеет значение',location:'Мост над каналом',concept:'Алгоритм',
      story:'До башни Ядра остался мост. Опоры могли пострадать во время сбоя. Набор верных действий ещё не делает алгоритм верным: важно, в каком порядке они выполняются.',
      quote:'У этих команд есть зависимости. Представь, что будет происходить после каждой строки.',
      task:'Выбери безопасный порядок действий.',facts:'Scan — осмотреть мост\nCheck — проверить результат\nCross — перейти',
      choices:[{id:'a',label:'Сначала данные, потом решение',code:'Scan;\nif Check then\n  Cross;',correct:true},{id:'b',label:'Сначала перейти',code:'Cross;\nScan;',correct:false},{id:'c',label:'Проверить ещё до осмотра',code:'if Check then\n  Cross;\nScan;',correct:false}],
      expected:'Scan;\nif Check then\n  Cross;',
      explanation:'Алгоритм — точная последовательность шагов для решения задачи. Check использует результат Scan, а Cross выполняется только после успешной проверки. Во время этой миссии функция Check возвращает true. В Pascal процедуры без параметров можно вызывать по имени: Scan; и Cross;.',
      success:'Сканер находит устойчивую полосу. Ты отмечаешь безопасный маршрут для жителей и переходишь канал.',
      failure:'Аварийная платформа подхватывает тебя у края. Ты добираешься до башни. Безопасный маршрут для жителей не подготовлен.'},
    {id:'alarm',title:'Люди за строкой кода',location:'Площадь перед Ядром',concept:'Если — иначе',
      story:'На площади ждут жители. Датчик сообщает о перегреве: warning = true. Правило города простое: при тревоге вывести людей, иначе продолжить работу. Последняя проверка касается тех, ради кого ты восстанавливаешь систему.',
      quote:'За каждой строкой здесь стоят люди. Сопоставь сигнал датчика с действием программы.',
      task:'При тревоге вызови Evacuate, иначе ContinueWork.',facts:'warning = true',
      choices:[{id:'a',label:'Тревога включает эвакуацию',code:'if warning then\n  Evacuate\nelse\n  ContinueWork;',correct:true},{id:'b',label:'Ветки перепутаны',code:'if warning then\n  ContinueWork\nelse\n  Evacuate;',correct:false},{id:'c',label:'Условие пропущено',code:'ContinueWork;',correct:false}],
      expected:'if warning then\n  Evacuate\nelse\n  ContinueWork;',
      explanation:'Полное ветвление if ... then ... else выбирает ровно одну ветвь. При warning = true выполняется Evacuate, а ContinueWork пропускается. В Pascal перед else точку с запятой не ставят. Без else ветвление неполное: при ложном условии блок просто пропускается.',
      success:'Площадь пустеет вовремя. Жители узнают, кто включил сигнал. Лума впервые называет тебя оператором, без слова «стажёр».',
      failure:'Тревогу замечает дежурный и выводит людей вручную. Все в безопасности, но доверие к автоматике не восстановлено.'}
  ];
  // Позиция верного ответа меняется от сцены к сцене.
  const displayOrders = ['bac', 'cba', 'acb', 'bca', 'cab'];
  challenges.forEach((challenge, i) => {
    challenge.choices = [...displayOrders[i]].map(id => challenge.choices.find(option => option.id === id));
  });
  const endings = [
    {id:'dawn',title:'Город нового рассвета',subtitle:'Ветвление снова ожило',color:'#B9F568',
      text:['На рассвете Ветвление наполняется светом. Загораются окна вдоль канала, открывается Южная станция, и первый поезд снова выходит на линию. Над водой опускается пешеходный мост.', 'Городской архив распахивает двери. На площади встречаются семьи, из пекарни доносится запах свежего хлеба. Больница и школы возвращаются к обычной работе.', 'Утро начинается с трамвайного звонка и шагов на набережной. Город цел и снова живёт своей жизнью.'],
      rule:'Режим «Восстановить», 0 ошибок, реле, архив и мост готовы, доверие > 0, энергия от 4 до 8.'},
    {id:'partial',title:'Свет в одном окне',subtitle:'Свет вернулся лишь в часть кварталов',color:'#A9A2FF',
      text:['На одном берегу канала загораются окна. На другом улицы остаются тёмными, а пустые станции встречают рассвет в тишине. Только несколько кварталов возвращаются к привычной жизни.', 'В освещённых домах соседи готовят еду на всех. У больницы дежурят автобусы, на площади открыт пункт помощи. Люди идут через город с фонарями и бумажными картами.', 'Ветвление живёт между светом и темнотой. В доме напротив башни горит одно окно, и за ним уже накрывают стол к утру.'],
      rule:'Режим «Восстановить», энергия > 0, реле готово, ошибок меньше 3, но условия полного восстановления не выполнены. При энергии 1–3 возможно только частичное восстановление.'},
    {id:'voice',title:'Голос города',subtitle:'Лума управляет Ветвлением',color:'#A9A2FF',
      text:['Над площадью раздаётся голос Лумы. Под её управлением оживают станции, меняется освещение улиц и расходятся первые утренние поезда. Город движется в новом, ровном ритме.', 'Лума направляет транспорт к переполненным остановкам и поддерживает связь с больницей. Её голос встречает жителей у переходов и сообщает о прибытии автобусов.', 'К рассвету у Ветвления появляется общее дыхание. В башне тихо мерцают огни, а знакомый голос слышен даже в самых дальних кварталах.'],
      rule:'Режим «Автономия», энергия > 0, реле готово и ошибок меньше 3. Эта ветвь проверяется раньше полного восстановления.'},
    {id:'safe',title:'Аварийный рассвет',subtitle:'Город живёт без автоматики',color:'#A9A2FF',
      text:['Большие экраны Ветвления темнеют. Вдоль улиц горят аварийные фонари, а у закрытых станций останавливаются утренние автобусы. Городская башня остаётся тихой.', 'Дежурные открывают переходы ключами и сверяют бумажные списки. В больнице принимают пациентов, соседи разносят воду, на площади работают волонтёры.', 'Город живёт ручным трудом и взаимной помощью. Над каналом светлеет небо, и в тишине особенно ясно слышны человеческие голоса.'],
      rule:'Режим «Остановить». Проверяется первым и срабатывает при любом состоянии систем.'},
    {id:'pause',title:'Город потерян',subtitle:'Восстановление невозможно',color:'#FF5B5B',
      text:['Башня Ядра разрушена. Над каналом лежат обломки моста, а подземные линии больше не соединяют районы. Ветвление невозможно восстановить.', 'Городские архивы утрачены безвозвратно. На пустых станциях стоят последние поезда. Ветер проходит через разбитые окна домов, где больше никто не живёт.', 'Жители покинули город. За ними закрылась последняя дорога, и на площади осталось только эхо шагов. Всё потеряно.'],
      rule:'При энергии > 0 выбран любой режим, кроме остановки, и при этом ошибок ≥ 3 ИЛИ реле выключено.'},
    {id:'energy',title:'Город без энергии',subtitle:'Город погрузился во тьму',color:'#FF5B5B',
      text:['В Ветвлении гаснут последние огни. Поезда замирают между станциями, часы на башне останавливаются, и тёмные окна отражают предрассветное небо.', 'Экран Лумы темнеет. Вместо её голоса остаётся короткая запись: «Связь потеряна». На улицах слышны только шаги дежурных и шум воды в канале.', 'Город встречает рассвет без света и движения. Люди собираются у пунктов помощи, пока над крышами медленно светлеет небо.'],
      rule:'Энергия достигла 0 из-за неустранённой общей утечки. Игра заканчивается немедленно на любом этапе; режим остановки не отменяет этот исход.'}
  ];
  const FINAL_CODE = "if energy <= 0 then\n  ending := 'Город без энергии'\nelse if mode = 3 then\n  ending := 'Аварийный рассвет'\nelse if (errors >= 3) or (not relay) then\n  ending := 'Город потерян'\nelse if mode = 2 then\n  ending := 'Голос города'\nelse if archive and bridge and (trust > 0)\n        and (energy >= 4) and (errors = 0) then\n  ending := 'Город нового рассвета'\nelse\n  ending := 'Свет в одном окне';";
  const createState=()=>({energy:MAX_ENERGY,energyLost:0,draining:false,nextEnergyAt:null,leakClosed:false,repairAvailable:true,gameOver:null,repairHistory:[],errors:0,archive:false,bridge:false,relay:false,trust:0,step:0,history:[],mode:null});
  const getChallenge=s=>challenges[s.step] || null;
  const SNAPSHOT_FIELDS=['energy','energyLost','draining','nextEnergyAt','leakClosed','repairAvailable','gameOver','errors','archive','bridge','relay','trust','step','mode'];
  function stateSnapshot(state) {
    return Object.fromEntries(SNAPSHOT_FIELDS.map(key=>[key,state[key]]));
  }
  function checkTime(now) {
    if(!Number.isFinite(now)) throw new Error('Время должно быть конечным числом');
  }
  function startDrain(state, now=0) {
    checkTime(now);
    if(state.draining || state.leakClosed || state.gameOver==='energy' || state.energy<=0) return state;
    return {...state,draining:true,nextEnergyAt:now+DRAIN_INTERVAL_MS};
  }
  function stopDrain(state) {
    if(!state.draining && state.nextEnergyAt===null) return state;
    return {...state,draining:false,nextEnergyAt:null};
  }
  function leaveRepair(state) {
    if(!state.repairAvailable) return state;
    return {...state,repairAvailable:false};
  }
  function advanceTime(state, now=0) {
    checkTime(now);
    if(state.energy<=0) {
      if(state.gameOver==='energy' && !state.draining && state.nextEnergyAt===null) return state;
      return {...state,energy:0,gameOver:'energy',draining:false,nextEnergyAt:null};
    }
    if(state.gameOver==='energy' || state.leakClosed || !state.draining) return state;
    if(now<state.nextEnergyAt) return state;
    const ticks=1+Math.floor((now-state.nextEnergyAt)/DRAIN_INTERVAL_MS);
    const lost=Math.min(state.energy,ticks);
    const energy=state.energy-lost;
    return {...state,energy,energyLost:state.energyLost+lost,
      gameOver:energy>0?null:'energy',draining:energy>0,nextEnergyAt:energy>0?state.nextEnergyAt+ticks*DRAIN_INTERVAL_MS:null};
  }
  function explanationFor(challenge,state) {
    if(challenge.id==='gate') {
      const allowed=state.energy>=2;
      return challenge.explanation+' Сейчас energy = '+state.energy+': '+state.energy+' >= 2 = '+allowed+'. '+(allowed?'Условие разрешает открыть шлюз.':'Условие не разрешает открыть шлюз. Недостаточный заряд не делает правило >= неверным: ошибку начисляют только за выбор другого правила.');
    }
    if(challenge.id==='relay') {
      const allowed=state.energy>=2;
      return challenge.explanation+' Сейчас energy = '+state.energy+', coolant = true: ('+state.energy+' >= 2) and true = '+allowed+'. '+(allowed?'При выборе правильного правила реле включается.':'Правильное правило не разрешает запуск при таком заряде. При выборе этого правила ответ засчитывается, но relay остаётся false.');
    }
    return challenge.explanation;
  }
  function applyChoice(state, id, now=0) {
    const current=advanceTime(state,now);
    if(current.gameOver==='energy') throw new Error('Игра завершена');
    const challenge=getChallenge(state);
    if(!challenge) throw new Error('Все задания уже завершены');
    const choice=challenge.choices.find(c=>c.id===id);
    if(!choice) throw new Error('Неизвестный вариант');
    let next={...current,history:[...current.history],step:current.step+1,repairAvailable:false};
    if(!choice.correct) next.errors++;
    if(current.step===1) next.archive=choice.correct;
    if(current.step===2) next.relay=choice.correct && current.energy>=2;
    if(current.step===3) next.bridge=choice.correct;
    if(current.step===4) next.trust=choice.correct?1:0;
    const explanation=explanationFor(challenge,current);
    let message=choice.correct?challenge.success:challenge.failure;
    if(choice.correct && current.step===0 && current.energy<2)
      message='Правило выбрано верно. Заряда недостаточно для штатного открытия: Лума проводит тебя по аварийному пути. Ошибка не начисляется.';
    if(choice.correct && current.step===2 && !next.relay)
      message='Правило выбрано верно. Но энергии меньше двух: безопасная проверка оставляет реле выключенным. Ошибка не начисляется.';
    const record={step:current.step,choiceId:id,correct:choice.correct,code:choice.code,expectedCode:challenge.expected,message,explanation,before:stateSnapshot(current),after:stateSnapshot(next)};
    next.history.push(record);
    return {state:next,result:{...record,message}};
  }
  function applyRepairChoice(state,id,now=0) {
    const current=advanceTime(state,now);
    if(current.gameOver==='energy') throw new Error('Игра завершена');
    if(current.leakClosed) throw new Error('Утечка уже устранена');
    if(!current.repairAvailable || current.step!==0) throw new Error('Ремонт больше недоступен');
    const choice=repairChallenge.choices.find(c=>c.id===id);
    if(!choice) throw new Error('Неизвестный вариант');
    let next={...current,repairHistory:[...current.repairHistory]};
    if(choice.correct) next=stopDrain({...next,leakClosed:true,repairAvailable:false});
    const message=choice.correct?repairChallenge.success:repairChallenge.failure;
    const explanation=repairChallenge.explanation+' Запас в момент выбора: '+current.energy+' из '+MAX_ENERGY+'.';
    const record={step:current.step,choiceId:id,correct:choice.correct,code:choice.code,expectedCode:repairChallenge.expected,message,explanation,before:stateSnapshot(current),after:stateSnapshot(next)};
    next.repairHistory.push(record);
    return {state:next,result:{...record}};
  }
  function resolveEnding(state,mode=null) {
    if(state.gameOver==='energy' || state.energy<=0)
      return {...endings.find(e=>e.id==='energy'),branchIndex:0,action:'Энергия потеряна',reason:endings.find(e=>e.id==='energy').rule,code:FINAL_CODE};
    if(state.step!==5) throw new Error('Сначала завершите все пять заданий');
    if(![1,2,3].includes(mode)) throw new Error('Неизвестный режим');
    let id,branchIndex;
    if(mode===3){id='safe';branchIndex=1;}
    else if(state.errors>=3 || !state.relay){id='pause';branchIndex=2;}
    else if(mode===2){id='voice';branchIndex=3;}
    else if(state.archive && state.bridge && state.trust>0 && state.energy>=4 && state.errors===0){id='dawn';branchIndex=4;}
    else {id='partial';branchIndex=5;}
    return {...endings.find(e=>e.id===id),branchIndex,action:getModeAction(mode),reason:endings.find(e=>e.id===id).rule,code:FINAL_CODE};
  }
  function getModeAction(mode) {
    switch (mode) {
      case 1: return 'Восстановить';
      case 2: return 'Автономия';
      case 3: return 'Остановить';
      default: throw new Error('Неизвестный режим');
    }
  }
  function restoreState(snapshot,now=0) {
    checkTime(now);
    const invalid=()=>{throw new Error('Повреждено сохранение');};
    const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
    const equal=(a,b,keys=SNAPSHOT_FIELDS)=>keys.every(key=>a[key]===b[key]);
    const flagKeys=['errors','archive','bridge','relay','trust','step'];
    let phaseOrigin=null;
    function readScalar(raw) {
      if(!object(raw)) invalid();
      const value=stateSnapshot(raw);
      for(const [key,min,max] of [['energy',0,MAX_ENERGY],['energyLost',0,MAX_ENERGY],['errors',0,5],['trust',0,1],['step',0,5]])
        if(!Number.isInteger(value[key]) || value[key]<min || value[key]>max) invalid();
      if(value.energyLost!==MAX_ENERGY-value.energy) invalid();
      for(const key of ['draining','leakClosed','repairAvailable','archive','bridge','relay']) if(typeof value[key]!=='boolean') invalid();
      if(value.repairAvailable && (value.step>0 || value.leakClosed)) invalid();
      if(value.gameOver!==null && value.gameOver!=='energy') invalid();
      if((value.energy===0)!==(value.gameOver==='energy')) invalid();
      if(value.mode!==null && (![1,2,3].includes(value.mode) || value.step!==5)) invalid();
      if(value.draining) {
        if(value.leakClosed || value.gameOver || !Number.isFinite(value.nextEnergyAt)) invalid();
        const origin=value.nextEnergyAt-value.energyLost*DRAIN_INTERVAL_MS;
        if(phaseOrigin===null) phaseOrigin=origin;
        else if(phaseOrigin!==origin) invalid();
      } else if(value.nextEnergyAt!==null) invalid();
      if(value.leakClosed && value.gameOver) invalid();
      return value;
    }
    const beforeDeadline=value=>value.draining?Math.min(0,value.nextEnergyAt-1):0;
    try {
      if(!object(snapshot) || !Array.isArray(snapshot.history) || !Array.isArray(snapshot.repairHistory)) invalid();
      const current=readScalar(snapshot);
      if(snapshot.history.length!==current.step || snapshot.history.length>challenges.length) invalid();
      const history=[],repairHistory=[],prefixes=[createState()];
      let previousEnergy=MAX_ENERGY;
      for(let index=0;index<snapshot.history.length;index++) {
        const raw=snapshot.history[index];
        if(!object(raw) || raw.step!==index) invalid();
        const before=readScalar(raw.before),after=readScalar(raw.after);
        if(before.energy>previousEnergy || !equal(before,prefixes[index],flagKeys)) invalid();
        const replay=applyChoice({...before,history:[...history],repairHistory:[]},raw.choiceId,beforeDeadline(before));
        const canonical=replay.state.history.at(-1);
        if(raw.correct!==canonical.correct || !equal(after,canonical.after)) invalid();
        history.push(canonical);
        prefixes.push(replay.state);
        previousEnergy=after.energy;
      }
      let repairedAt=null,repairedEnergy=null,previousRepairEnergy=MAX_ENERGY,previousRepairStep=0;
      for(const raw of snapshot.repairHistory) {
        if(!object(raw) || repairedAt!==null) invalid();
        const before=readScalar(raw.before),after=readScalar(raw.after);
        if(raw.step!==before.step || before.step!==0 || before.step>current.step || before.step<previousRepairStep
          || before.energy>previousRepairEnergy || before.energy>prefixes[before.step].energy
          || !equal(before,prefixes[before.step],flagKeys)) invalid();
        const replay=applyRepairChoice({...before,history:[],repairHistory:[...repairHistory]},raw.choiceId,beforeDeadline(before));
        const canonical=replay.state.repairHistory.at(-1);
        if(raw.correct!==canonical.correct || !equal(after,canonical.after)) invalid();
        repairHistory.push(canonical);
        if(canonical.correct) {repairedAt=before.step;repairedEnergy=after.energy;}
        previousRepairEnergy=after.energy;
        previousRepairStep=before.step;
      }
      if(current.leakClosed!==(repairedAt!==null) || !equal(current,prefixes[current.step],flagKeys)) invalid();
      if(current.energy>previousEnergy || current.energy>previousRepairEnergy) invalid();
      if(current.leakClosed && current.energy!==repairedEnergy) invalid();
      for(const record of history) {
        const shouldBeClosed=repairedAt!==null && record.step>=repairedAt;
        if(record.before.leakClosed!==shouldBeClosed || record.after.leakClosed!==shouldBeClosed) invalid();
        if(shouldBeClosed && record.before.energy!==repairedEnergy) invalid();
      }
      return advanceTime({...current,history,repairHistory},now);
    } catch(_) {
      invalid();
    }
  }
  return {MAX_ENERGY,DRAIN_INTERVAL_MS,createState,challenges,repairChallenge,endings,getChallenge,startDrain,stopDrain,leaveRepair,advanceTime,applyChoice,applyRepairChoice,restoreState,resolveEnding,getModeAction,FINAL_CODE};
});
