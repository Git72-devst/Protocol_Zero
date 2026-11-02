program ZeroProtocol;

{$mode objfpc}{$H+}{$codepage utf8}

uses
  SysUtils
  {$IFDEF WINDOWS}, Windows{$ENDIF};

const
  MissionCount = 5;
  LeakIntervalMs = 5000;
  CorrectChoices: array[1..MissionCount] of Integer = (2, 3, 1, 3, 2);
  MissionNames: array[1..MissionCount] of string =
    ('Шлюз на станции', 'Городской архив', 'Реле питания',
     'Мост последовательности', 'Сигнал тревоги');

type
  TState = record
    Energy, Errors, Trust: Integer;
    Archive, Relay, Bridge: Boolean;
    ValveClosed, LeakClosed: Boolean;
  end;
  TDecision = record
    Choice: Integer;
    Correct: Boolean;
    AfterState: TState;
  end;
  TJournal = array[1..MissionCount] of TDecision;
  TEnding = (edDawn, edPartial, edVoice, edSafe, edPause, edNoEnergy);
  EEnergyDepleted = class(Exception);

var
  LeakActive: Boolean = False;
  LeakTick: QWord = 0;

function BoolText(Value: Boolean): string;
begin
  if Value then
    Result := 'True'
  else
    Result := 'False';
end;

procedure StartLeak;
begin
  { Единственный запуск на всю новую игру. Ответы не перезапускают часы. }
  LeakTick := SysUtils.GetTickCount64;
  LeakActive := True;
end;

procedure UpdateLeak(var State: TState);
var
  NowTick, Intervals: QWord;
  BeforeEnergy: Integer;
begin
  if State.Energy <= 0 then
    raise EEnergyDepleted.Create('Запас энергии исчерпан');
  if not LeakActive then
    Exit;
  NowTick := SysUtils.GetTickCount64;
  Intervals := (NowTick - LeakTick) div LeakIntervalMs;
  if Intervals = 0 then
    Exit;
  { Сохраняем остаток времени, а не начинаем пять секунд заново. }
  Inc(LeakTick, Intervals * LeakIntervalMs);
  BeforeEnergy := State.Energy;
  if Intervals >= QWord(State.Energy) then
    State.Energy := 0
  else
    Dec(State.Energy, Integer(Intervals));
  if State.Energy <> BeforeEnergy then
    WriteLn('[Утечка] energy: ', BeforeEnergy, ' -> ', State.Energy,
      '. Потеря заряда: ', BeforeEnergy - State.Energy, '.');
  if State.Energy <= 0 then
    raise EEnergyDepleted.Create('Запас энергии исчерпан');
end;

procedure StopLeak;
begin
  LeakActive := False;
end;

function ReadChoice(const Prompt: string; MinValue, MaxValue: Integer): Integer;
var
  Raw: string;
  Parsed: Integer;
begin
  repeat
    Write(Prompt);
    if EOF(Input) then
    begin
      WriteLn;
      WriteLn('Ввод завершён. Журнал остаётся в выводе терминала.');
      Halt(0);
    end;
    ReadLn(Raw);
    Parsed := 0;
    if TryStrToInt(Trim(Raw), Parsed) then
      if (Parsed >= MinValue) and (Parsed <= MaxValue) then
        Exit(Parsed);
    WriteLn('Введите целое число от ', MinValue, ' до ', MaxValue, '.');
  until False;
end;

function ReadTimedChoice(const Prompt: string; MinValue, MaxValue: Integer;
  var State: TState): Integer;
var
  Raw: string;
  Parsed: Integer;
begin
  repeat
    UpdateLeak(State);
    Write(Prompt);
    if EOF(Input) then
    begin
      UpdateLeak(State);
      WriteLn;
      WriteLn('Ввод завершён. Журнал остаётся в выводе терминала.');
      Halt(0);
    end;
    ReadLn(Raw);
    UpdateLeak(State);
    Parsed := 0;
    if TryStrToInt(Trim(Raw), Parsed) then
      if (Parsed >= MinValue) and (Parsed <= MaxValue) then
        Exit(Parsed);
    WriteLn('Введите целое число от ', MinValue, ' до ', MaxValue,
      '. Интервал утечки не сбрасывается.');
  until False;
end;

procedure WaitAfterExplanation(Mission: Integer; var State: TState);
var
  Raw: string;
begin
  UpdateLeak(State);
  WriteLn;
  if LeakActive then
    WriteLn('Утечка продолжается и во время разбора. Заряд обновится при Enter.')
  else
    WriteLn('Утечка остановлена. Разбор можно читать без потери энергии.');
  if Mission < MissionCount then
    Write('Нажмите Enter для следующего задания: ')
  else
    Write('Нажмите Enter, чтобы перейти к финальному выбору: ');
  if EOF(Input) then
  begin
    UpdateLeak(State);
    WriteLn;
    WriteLn('Ввод завершён. Журнал остаётся в выводе терминала.');
    Halt(0);
  end;
  ReadLn(Raw);
  UpdateLeak(State);
end;

procedure ShowState(const State: TState);
begin
  WriteLn('  energy = ', State.Energy, '   errors = ', State.Errors,
    '   trust = ', State.Trust);
  WriteLn('  archive = ', BoolText(State.Archive),
    '   relay = ', BoolText(State.Relay),
    '   bridge = ', BoolText(State.Bridge));
  WriteLn('  valveClosed = ', BoolText(State.ValveClosed),
    '   leakClosed = ', BoolText(State.LeakClosed));
end;

procedure InitState(out State: TState);
begin
  State.Energy := 8;
  State.Errors := 0;
  State.Trust := 0;
  State.Archive := False;
  State.Relay := False;
  State.Bridge := False;
  State.ValveClosed := False;
  State.LeakClosed := False;
end;

procedure CloseValve(var State: TState);
begin
  State.ValveClosed := True;
end;

function IsSealed(const State: TState): Boolean;
begin
  Result := State.ValveClosed;
end;

procedure RepairTerminal(var State: TState);
var
  Choice: Integer;
  LeakDetected: Boolean;
  Candidate: TState;
begin
  if State.LeakClosed then
    Exit;
  repeat
    UpdateLeak(State);
    WriteLn;
    WriteLn('================ ТЕРМИНАЛ УТЕЧКИ ========================');
    WriteLn('Из контура уходит энергия. leakDetected = True.');
    WriteLn('CloseValve закрывает клапан физически, IsSealed проверяет герметичность.');
    WriteLn('Записи leakClosed := True без закрытия клапана недостаточно.');
    WriteLn('Энергия сейчас: ', State.Energy, '. Лума: «Контур ждёт команду».');
    WriteLn;
    WriteLn('1) if not leakDetected then CloseValve;');
    WriteLn('2) if leakDetected then');
    WriteLn('   begin');
    WriteLn('     CloseValve;');
    WriteLn('     if IsSealed then leakClosed := True;');
    WriteLn('   end;');
    WriteLn('3) leakClosed := True;');
    WriteLn('0) Продолжить маршрут с утечкой');
    Choice := ReadTimedChoice('Команда терминала (0-3): ', 0, 3, State);
    UpdateLeak(State);
    if Choice = 0 then
    begin
      WriteLn('Терминал закрыт. Маршрут продолжается с активной утечкой.');
      Exit;
    end;
    { Исполняем предложение в проверяемом состоянии. Физический датчик
      не позволяет принять один лишь присвоенный флаг за закрытый контур. }
    Candidate := State;
    LeakDetected := not State.LeakClosed;
    case Choice of
      1:
        if not LeakDetected then
          CloseValve(Candidate);
      2:
        if LeakDetected then
        begin
          CloseValve(Candidate);
          if IsSealed(Candidate) then
            Candidate.LeakClosed := True;
        end;
      3: Candidate.LeakClosed := True;
    end;
    if Candidate.LeakClosed and IsSealed(Candidate) then
    begin
      State.ValveClosed := Candidate.ValveClosed;
      State.LeakClosed := True;
      StopLeak;
      WriteLn('Клапан закрыт, датчик подтвердил герметичность. Утечка устранена навсегда.');
      WriteLn('Вариант 2 связывает обнаружение, действие и проверку результата.');
      WriteLn('Оставшийся заряд сохранится во всех заданиях и при выборе концовки.');
      Exit;
    end;
    WriteLn('Ремонт не выполнен. Клапан открыт, утечка продолжается.');
    if Choice = 1 then
      WriteLn('not True = False: ветвь CloseValve не выполнилась.')
    else
      WriteLn('Присваивание флага не меняет клапан. IsSealed = False, команда отклонена.');
    WriteLn('Попробуйте другую команду. errors основных заданий не увеличивается.');
  until False;
end;

procedure ShowIntroduction;
begin
  WriteLn;
  WriteLn('============================================================');
  WriteLn('                    НУЛЕВОЙ ПРОТОКОЛ');
  WriteLn('           Сюжетная игра: алгоритмы и условия Pascal');
  WriteLn('============================================================');
  WriteLn;
  WriteLn('Город Ветвление замолчал. Центральное Ядро сохранило команды,');
  WriteLn('но потеряло правила выбора. Двери не открываются, архивы');
  WriteLn('требуют лишние разрешения, а мосты путают порядок действий.');
  WriteLn;
  WriteLn('Ты - стажёр-оператор. Помощница Лума читает состояние города,');
  WriteLn('но исправить алгоритм должен человек. До рассвета одна смена.');
  WriteLn('Лума: «Я выполню команды. Помоги понять, когда их выполнять».');
  WriteLn;
  WriteLn('В каждой сцене выбери один из трёх вариантов кода Pascal.');
  WriteLn('Один ответ на сцену. Ошибка меняет состояние, но история');
  WriteLn('продолжается по аварийному пути. В конце доступны три режима');
  WriteLn('и шесть концовок. Новый проход начинается с исходных значений.');
  WriteLn;
  WriteLn('В начале запас энергии равен 8. Во время активной утечки');
  WriteLn('каждые 5 секунд теряется 1 единица, минимум 0. Время считается');
  WriteLn('по реальным часам, а число в консоли обновляется при Enter.');
  WriteLn('Утечка одна на всю игру. Обычные ответы, паузы и меню');
  WriteLn('не останавливают и не перезапускают её. Прямого штрафа за ошибку нет.');
  WriteLn('Остановить утечку навсегда можно только в терминале ремонта:');
  WriteLn('нужно закрыть клапан и проверить герметичность до выхода на маршрут.');
  WriteLn('В терминале можно повторять попытки или пропустить ремонт командой 0.');
  WriteLn('После выхода на маршрут вернуться к ремонту уже нельзя.');
  WriteLn('При energy = 0 игра сразу заканчивается: «Город без энергии».');
  WriteLn('В переносимой консоли это обнаружится при ближайшем Enter.');
end;

procedure ShowMission(Mission: Integer; const State: TState);
begin
  WriteLn;
  WriteLn('------------------------------------------------------------');
  WriteLn('ЭТАП ', Mission, ' / ', MissionCount, '. ', MissionNames[Mission]);
  WriteLn('------------------------------------------------------------');
  case Mission of
    1:
      begin
        WriteLn('На станции шлюз ждёт точного правила. Энергии сейчас ',
          State.Energy, '.');
        WriteLn('По инструкции дверь открывается, если энергии не меньше двух.');
        WriteLn('Лума: «Станция ждёт решение оператора».');
        WriteLn('Как записать условие, включая границу 2?');
        WriteLn;
        WriteLn('1) if energy > 3 then OpenGate;');
        WriteLn('2) if energy >= 2 then OpenGate;');
        WriteLn('3) if energy = 2 then OpenGate;');
      end;
    2:
      begin
        WriteLn('В архиве хранится карта систем. Пропуска нет, код известен.');
        WriteLn('hasPass = False, knowsCode = True.');
        WriteLn('По правилам архива достаточно любого одного разрешения.');
        WriteLn('Лума: «Карта систем хранится за этой дверью».');
        WriteLn;
        WriteLn('1) if hasPass and knowsCode then archive := True;');
        WriteLn('2) if not knowsCode then archive := True;');
        WriteLn('3) if hasPass or knowsCode then archive := True;');
      end;
    3:
      begin
        WriteLn('Реле питает Ядро. Нужны заряд не меньше двух И охлаждение.');
        WriteLn('energy = ', State.Energy, ', coolant = True.');
        WriteLn('Правило должно работать при любых значениях датчиков.');
        WriteLn('Лума: «Реле ждёт новую команду».');
        WriteLn;
        WriteLn('1) if (energy >= 2) and coolant then relay := True;');
        WriteLn('2) if (energy >= 2) or coolant then relay := True;');
        WriteLn('3) if (energy >= 2) and not coolant then relay := True;');
      end;
    4:
      begin
        WriteLn('До Ядра ведёт мост. Scan получает данные, Check проверяет');
        WriteLn('безопасность и возвращает Boolean, Cross переводит через мост.');
        WriteLn('В этой сцене осмотр успешен: после Scan функция Check = True.');
        WriteLn('Лума: «За мостом находится пульт Ядра».');
        WriteLn;
        WriteLn('1) Cross; Scan; if Check then MarkRoute;');
        WriteLn('2) if Check then Cross; Scan;');
        WriteLn('3) Scan; if Check then Cross;');
      end;
    5:
      begin
        WriteLn('У Ядра собрались жители. Датчик сообщает: warning = True.');
        WriteLn('При тревоге нужна эвакуация, иначе можно продолжать работу.');
        WriteLn('Лума: «Жители ждут нашего решения».');
        WriteLn;
        WriteLn('1) if warning then ContinueWork else Evacuate;');
        WriteLn('2) if warning then Evacuate else ContinueWork;');
        WriteLn('3) ContinueWork;');
      end;
  end;
end;

procedure ApplyAnswer(Mission, Choice: Integer; var State: TState;
  var Journal: TJournal);
var
  Correct: Boolean;
begin
  UpdateLeak(State);
  Correct := Choice = CorrectChoices[Mission];
  if not Correct then
    Inc(State.Errors);
  case Mission of
    2: State.Archive := Correct;
    3: State.Relay := Correct and (State.Energy >= 2);
    4: State.Bridge := Correct;
    5:
      if Correct then
        State.Trust := 1
      else
        State.Trust := 0;
  end;
  Journal[Mission].Choice := Choice;
  Journal[Mission].Correct := Correct;
  Journal[Mission].AfterState := State;
end;

procedure ShowExplanation(Mission: Integer; Correct: Boolean; const State: TState);
begin
  WriteLn;
  if Correct then
    WriteLn('ВЕРНО. Правило восстановлено.')
  else
    WriteLn('ОШИБКА. Лума включает аварийный маршрут.');
  case Mission of
    1:
      begin
        WriteLn('Правильный вариант 2: if energy >= 2 then OpenGate;');
        WriteLn('>= означает «больше или равно». Граница 2 включена.');
        WriteLn('На момент ответа energy = ', State.Energy,
          ', проверка energy >= 2 даёт ', BoolText(State.Energy >= 2), '.');
        if Correct and (State.Energy >= 2) then
          WriteLn('Шлюз открылся по восстановленному правилу.')
        else if Correct then
          WriteLn('Правило верно, но заряда уже мало. Лума открывает аварийный проход.')
        else
          WriteLn('Лума открывает аварийный проход.');
      end;
    2:
      begin
        WriteLn('Правильный вариант 3: hasPass or knowsCode.');
        WriteLn('or (ИЛИ) требует хотя бы одно True. False or True = True.');
        WriteLn('and потребовало бы оба разрешения. not True = False.');
        if not Correct then
          WriteLn('Архив остаётся закрыт. Идём дальше по неполной схеме.');
      end;
    3:
      begin
        WriteLn('Правильный вариант 1: (energy >= 2) and coolant.');
        WriteLn('and (И) требует одновременной истинности обеих проверок.');
        WriteLn('Например, при energy = 3 и coolant = False выражение с or даст True,');
        WriteLn('хотя охлаждения нет. Выражение с and даст False.');
        WriteLn('Правильное правило должно учитывать и такой случай.');
        WriteLn('Сейчас energy = ', State.Energy, ', coolant = True. Результат and: ',
          BoolText(State.Energy >= 2), '.');
        if Correct and State.Relay then
          WriteLn('Реле включилось: правильное правило и достаточный заряд.')
        else if Correct then
          WriteLn('Ответ верен, но energy < 2. Условие ложно, реле не включилось.')
        else
          WriteLn('Аппаратная защита отклонила правило. Реле выключено.');
      end;
    4:
      begin
        WriteLn('Правильный вариант 3: Scan; if Check then Cross;');
        WriteLn('Алгоритм задаёт порядок. Check использует данные Scan,');
        WriteLn('а Cross выполняется только при успешной проверке Check.');
        if not Correct then
          WriteLn('Лума вызвала аварийную платформу. Основной мост закрыт.');
      end;
    5:
      begin
        WriteLn('Правильный вариант 2:');
        WriteLn('if warning then');
        WriteLn('  Evacuate');
        WriteLn('else');
        WriteLn('  ContinueWork;');
        WriteLn('При warning = True выполняется Evacuate, ветвь else пропускается.');
        WriteLn('Перед else не ставят точку с запятой.');
        if not Correct then
          WriteLn('Дежурный вывел людей вручную. Доверие не восстановлено.');
      end;
  end;
end;

procedure ShowJournal(const Journal: TJournal; const State: TState);
var
  I: Integer;
begin
  WriteLn;
  WriteLn('==================== ЖУРНАЛ РЕШЕНИЙ =======================');
  for I := 1 to MissionCount do
  begin
    Write(I, '. ', MissionNames[I], ': выбран ', Journal[I].Choice, ' - ');
    if Journal[I].Correct then WriteLn('ВЕРНО') else WriteLn('ОШИБКА');
    ShowState(Journal[I].AfterState);
  end;
  WriteLn('Состояние перед финальным выбором:');
  ShowState(State);
end;

function SelectEnding(const State: TState; Mode: Integer): TEnding;
begin
  if State.Energy <= 0 then
    Result := edNoEnergy
  else if Mode = 3 then
    Result := edSafe
  else if (State.Errors >= 3) or not State.Relay then
    Result := edPause
  else if Mode = 2 then
    Result := edVoice
  else if State.Archive and State.Bridge and (State.Trust > 0)
    and (State.Energy >= 4) and (State.Errors = 0) then
    Result := edDawn
  else
    Result := edPartial;
end;

procedure ShowFinalAlgorithm;
begin
  WriteLn;
  WriteLn('АЛГОРИТМ ВЫБОРА КОНЦОВКИ (Pascal)');
  WriteLn('if energy <= 0 then');
  WriteLn('  ending := ''Город без энергии''');
  WriteLn('else if mode = 3 then');
  WriteLn('  ending := ''Аварийный рассвет''');
  WriteLn('else if (errors >= 3) or not relay then');
  WriteLn('  ending := ''Город потерян''');
  WriteLn('else if mode = 2 then');
  WriteLn('  ending := ''Голос города''');
  WriteLn('else if archive and bridge and (trust > 0)');
  WriteLn('  and (energy >= 4) and (errors = 0) then');
  WriteLn('  ending := ''Город нового рассвета''');
  WriteLn('else');
  WriteLn('  ending := ''Свет в одном окне'';');
  WriteLn;
end;

procedure ShowEnding(Ending: TEnding);
begin
  WriteLn;
  WriteLn('============================================================');
  case Ending of
    edDawn:
      begin
        WriteLn('КОНЦОВКА: Город нового рассвета');
        WriteLn;
        WriteLn('Первый луч касается крыши Ядра, и город отвечает светом.');
        WriteLn('Архив возвращает адреса, мост принимает пешеходов, трамваи');
        WriteLn('возвращаются на линии. Жители уже в безопасной зоне.');
        WriteLn;
        WriteLn('На площади открываются двери домов. Ветвление встречает');
        WriteLn('рассвет живым городом, в котором снова слышны голоса людей.');
      end;
    edPartial:
      begin
        WriteLn('КОНЦОВКА: Свет в одном окне');
        WriteLn;
        WriteLn('Ядро запускается тихо. Свет возвращается в больницу');
        WriteLn('и жилой квартал. Несколько районов остаются на резерве.');
        WriteLn;
        WriteLn('Трамваи стоят на путях, а центральная площадь остаётся тёмной.');
        WriteLn('В доме напротив загорается одно окно. Часть города выстояла.');
      end;
    edVoice:
      begin
        WriteLn('КОНЦОВКА: Голос города');
        WriteLn;
        WriteLn('Голос Лумы звучит из городских динамиков. Она распределяет');
        WriteLn('питание и открывает безопасные маршруты. На перекрёстках');
        WriteLn('включаются светофоры, по улицам идут первые трамваи.');
        WriteLn;
        WriteLn('Оператор остаётся у пульта, а город просыпается под знакомый');
        WriteLn('голос помощницы. Управление Ветвлением теперь принадлежит Луме.');
      end;
    edSafe:
      begin
        WriteLn('КОНЦОВКА: Аварийный рассвет');
        WriteLn;
        WriteLn('Ядро гасит основные системы и замирает.');
        WriteLn('Независимые аварийные лампы освещают выходы. Ремонтные');
        WriteLn('бригады получают карту повреждений. Лума остаётся');
        WriteLn('в переносном терминале рядом с оператором.');
        WriteLn;
        WriteLn('Жители покидают опасные кварталы. Город встречает рассвет');
        WriteLn('без основного света, под защитой независимой аварийной сети.');
      end;
    edPause:
      begin
        WriteLn('КОНЦОВКА: Город потерян');
        WriteLn;
        WriteLn('Ядро выгорает. Цепной сбой стирает архивы и обрывает');
        WriteLn('городскую сеть. Мосты замирают, на станциях гаснут огни.');
        WriteLn('От Ветвления остаются пустые улицы и безмолвные здания.');
        WriteLn;
        WriteLn('Повреждения необратимы. Восстановить город невозможно.');
        WriteLn('Всё утрачено.');
      end;
    edNoEnergy:
      begin
        WriteLn('КОНЦОВКА: Город без энергии');
        WriteLn;
        WriteLn('Последний заряд уходит через незакрытый клапан. Экран гаснет');
        WriteLn('раньше, чем новая команда успевает изменить систему.');
        WriteLn('Независимые фонари освещают выходы, а ремонтная бригада');
        WriteLn('принимает город под ручное управление.');
        WriteLn;
        WriteLn('Лума не на связи');
        WriteLn('Связь с Ядром потеряна. Команды больше не поступают.');
        WriteLn('Смена завершена в тишине обесточенного города.');
      end;
  end;
  WriteLn('============================================================');
end;

procedure PlayGame;
var
  State: TState;
  Journal: TJournal;
  Mission, Choice, Mode: Integer;
  Action: string;
begin
  InitState(State);
  StartLeak;
  try
    ShowIntroduction;
    WriteLn;
    WriteLn('Исходное состояние:');
    ShowState(State);
    RepairTerminal(State);
    for Mission := 1 to MissionCount do
    begin
      UpdateLeak(State);
      ShowMission(Mission, State);
      Choice := ReadTimedChoice('Ваш вариант (1-3): ', 1, 3, State);
      ApplyAnswer(Mission, Choice, State, Journal);
      ShowExplanation(Mission, Journal[Mission].Correct, State);
      WriteLn('Состояние после решения:');
      ShowState(State);
      if Mission < MissionCount then
        WaitAfterExplanation(Mission, State);
    end;
    UpdateLeak(State);
    ShowJournal(Journal, State);
    WriteLn;
    WriteLn('ФИНАЛЬНАЯ КОМАНДА');
    if LeakActive then
      WriteLn('Клапан не закрыт. Утечка продолжается во время финального выбора.')
    else
      WriteLn('Клапан закрыт. Запас энергии сохранится при выборе режима.');
    WriteLn('mode = 1: управление людьми, 2: управление Лумой, 3: остановка.');
    WriteLn('1) mode := 1;');
    WriteLn('2) mode := 2;');
    WriteLn('3) mode := 3;');
    Mode := ReadTimedChoice('Выберите режим (1-3): ', 1, 3, State);
    StopLeak;
    WriteLn('Состояние на момент финальной команды:');
    ShowState(State);

    { Реальный множественный выбор по значению, а не только текст примера. }
    case Mode of
      1: Action := 'Восстановить';
      2: Action := 'Автономия';
      3: Action := 'Остановить';
    else
      Action := 'Неизвестный режим';
    end;
    WriteLn('case mode of выбрал действие: ', Action);
    ShowFinalAlgorithm;
    ShowEnding(SelectEnding(State, Mode));
  except
    on E: EEnergyDepleted do
    begin
      StopLeak;
      ShowState(State);
      ShowEnding(edNoEnergy);
    end;
  end;
end;

begin
  {$IFDEF WINDOWS}
  SetConsoleOutputCP(CP_UTF8);
  SetConsoleCP(CP_UTF8);
  SetTextCodePage(Output, CP_UTF8);
  SetTextCodePage(Input, CP_UTF8);
  {$ENDIF}

  repeat
    PlayGame;
    WriteLn;
    WriteLn('1) Сыграть снова   2) Выйти');
    if ReadChoice('Выбор (1-2): ', 1, 2) = 2 then
      Break;
  until False;
  WriteLn('Сеанс завершён');
end.
