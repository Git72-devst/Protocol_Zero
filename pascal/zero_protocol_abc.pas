program ZeroProtocolABC;



uses System;

const
  MissionCount = 5;
  InitialEnergy = 8;
  DrainIntervalMs = 5000;
  CorrectChoices: array[1..MissionCount] of Integer = (2, 3, 1, 3, 2);
  MissionNames: array[1..MissionCount] of string =
    ('Шлюз на станции', 'Городской архив', 'Реле питания',
     'Мост последовательности', 'Сигнал тревоги');

type
  TState = record
    Energy, Errors, Trust: Integer;
    Archive, Relay, Bridge: Boolean;
  end;
  TDecision = record
    Choice: Integer;
    Correct: Boolean;
    AfterState: TState;
  end;
  TJournal = array[1..MissionCount] of TDecision;
  TEnding = (edDawn, edPartial, edVoice, edSafe, edPause, edEnergy);

var
  State: TState;
  LeakActive: Boolean;
  LeakClosed, LeakDetected, ValveClosed: Boolean;
  LastDrainMs: Int64;
  Clock: System.Diagnostics.Stopwatch;

procedure UpdateLeak;
var
  NowMs, Ticks: Int64;
begin
  if not LeakActive then Exit;
  NowMs := Clock.ElapsedMilliseconds;
  Ticks := (NowMs - LastDrainMs) div DrainIntervalMs;
  if Ticks <= 0 then Exit;
  LastDrainMs := LastDrainMs + Ticks * DrainIntervalMs;
  if Ticks >= State.Energy then State.Energy := 0
  else State.Energy := State.Energy - Integer(Ticks);
  if State.Energy <= 0 then
    raise new System.InvalidOperationException('ENERGY_DEPLETED');
end;

procedure StartLeak;
begin
  if not LeakClosed then
  begin
    if LeakActive then UpdateLeak
    else
    begin
      LastDrainMs := Clock.ElapsedMilliseconds;
      LeakActive := True;
    end;
  end;
end;

procedure StopLeak;
begin
  UpdateLeak;
  LeakActive := False;
end;

function ReadInput(const Prompt: string): string;
var
  Raw: string;
  Key: System.ConsoleKeyInfo;
  BeforeEnergy: Integer;
begin
  UpdateLeak;
  Write(Prompt);
  Raw := '';
  if System.Console.IsInputRedirected then
  begin
    BeforeEnergy := State.Energy;
    Raw := System.Console.ReadLine;
    UpdateLeak;
    if State.Energy <> BeforeEnergy then
      WriteLn('Утечка: energy = ', State.Energy);
  end
  else
  begin
    repeat
      BeforeEnergy := State.Energy;
      UpdateLeak;
      if State.Energy <> BeforeEnergy then
      begin
        WriteLn;
        WriteLn('Утечка: energy = ', State.Energy);
        Write(Prompt, Raw);
      end;
      if System.Console.KeyAvailable then
      begin
        Key := System.Console.ReadKey(True);
        if Key.Key = System.ConsoleKey.Enter then
        begin
          WriteLn;
          Break;
        end
        else if Key.Key = System.ConsoleKey.Backspace then
        begin
          if Raw.Length > 0 then
          begin
            Raw := Raw.Remove(Raw.Length - 1);
            Write(#8, ' ', #8);
          end;
        end
        else if Key.KeyChar >= ' ' then
        begin
          Raw := Raw + Key.KeyChar;
          Write(Key.KeyChar);
        end;
      end;
      System.Threading.Thread.Sleep(25);
    until False;
    UpdateLeak;
  end;
  if Raw = nil then
  begin
    WriteLn;
    WriteLn('Ввод завершён. Журнал остаётся в выводе терминала.');
    System.Environment.Exit(0);
  end;
  Result := Raw;
end;

function BoolText(Value: Boolean): string;
begin
  if Value then
    Result := 'True'
  else
    Result := 'False';
end;

function ReadChoice(const Prompt: string; MinValue, MaxValue: Integer): Integer;
var
  Raw: string;
  Parsed: Integer;
begin
  repeat
    Raw := ReadInput(Prompt);
    Parsed := 0;
    if System.Int32.TryParse(Raw.Trim, Parsed) then
      if (Parsed >= MinValue) and (Parsed <= MaxValue) then
      begin
        Result := Parsed;
        Exit;
      end;
    WriteLn('Введите целое число от ', MinValue, ' до ', MaxValue, '.');
  until False;
end;

procedure CloseValve;
begin
  ValveClosed := True;
end;

function IsSealed: Boolean;
begin
  Result := ValveClosed;
end;

procedure ShowLeakStatus;
begin
  if LeakClosed then
    WriteLn('Утечка закрыта. В этом прохождении она больше не появится.')
  else
    WriteLn('Утечка активна: каждые 5 секунд -1, даже во время разбора.');
end;

procedure RepairTerminal;
var
  Choice: Integer;
begin
  while not LeakClosed do
  begin
    UpdateLeak;
    WriteLn;
    WriteLn('=============== АВАРИЙНЫЙ РЕМОНТНЫЙ ТЕРМИНАЛ ===============');
    WriteLn('energy = ', State.Energy, ', leakDetected = True.');
    WriteLn('Нужно физически закрыть клапан и проверить герметичность.');
    WriteLn('Лума: «Основной маршрут не устранит повреждение трубопровода».');
    WriteLn;
    WriteLn('1) if not leakDetected then CloseValve;');
    WriteLn('2) if leakDetected then');
    WriteLn('   begin');
    WriteLn('     CloseValve;');
    WriteLn('     if IsSealed then leakClosed := True;');
    WriteLn('   end;');
    WriteLn('3) leakClosed := True;');
    WriteLn('0) Продолжить маршрут с утечкой');
    Choice := ReadChoice('Ремонт: код 1-3 или 0 для маршрута: ', 0, 3);
    UpdateLeak;
    if Choice = 0 then
    begin
      WriteLn('Ремонт пропущен. Терминал закрыт до конца прохождения.');
      WriteLn('Фаза пятисекундного интервала сохранена.');
      Exit;
    end;
    if Choice = 2 then
    begin
      { Реальный физический шаг и подтверждение, показанные игроку. }
      if LeakDetected then
      begin
        CloseValve;
        if IsSealed then LeakClosed := True;
      end;
      if LeakClosed then
      begin
        LeakActive := False;
        WriteLn('Клапан закрыт, герметичность подтверждена. leakClosed = True.');
        WriteLn('Остаток энергии сохранён до конца этого прохождения.');
      end;
    end
    else
    begin
      WriteLn('Неверный ремонтный алгоритм. Физическая утечка продолжается.');
      if Choice = 1 then
        WriteLn('not leakDetected ложно: при обнаруженной утечке клапан не закроется.')
      else
        WriteLn('Одна запись флага не закрывает клапан и не проверяет IsSealed.');
      WriteLn('Попробуй снова или продолжи маршрут. Интервал не сброшен.');
    end;
  end;
end;
procedure ShowState(const State: TState);
begin
  WriteLn('  energy = ', State.Energy, '   errors = ', State.Errors,
    '   trust = ', State.Trust);
  WriteLn('  archive = ', BoolText(State.Archive),
    '   relay = ', BoolText(State.Relay),
    '   bridge = ', BoolText(State.Bridge));
end;

procedure InitState(var State: TState);
begin
  State.Energy := InitialEnergy;
  State.Errors := 0;
  State.Trust := 0;
  State.Archive := False;
  State.Relay := False;
  State.Bridge := False;
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
  WriteLn('Запас: 8 единиц. Пока активна утечка, каждые 5 секунд -1.');
  WriteLn('Утечку закрывает отдельный ремонт клапана, до пяти заданий.');
  WriteLn('Обычные ответы, разбор и переход не останавливают утечку.');
  WriteLn('После ремонта она больше не появляется в этом прохождении.');
  WriteLn('Ремонт доступен только сейчас. После пропуска вернуться нельзя.');
  WriteLn('При energy = 0 немедленно наступает «Город без энергии».');
  WriteLn('Ни ответ на задание, ни режим остановки уже не спасут систему.');
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
        WriteLn('Дверь открывается, если энергии не меньше двух.');
        WriteLn('Лума: «Станция больше не доверяет повреждённому протоколу».');
        WriteLn('Выбери код, который соответствует правилу.');
        WriteLn;
        WriteLn('1) if energy > 3 then OpenGate;');
        WriteLn('2) if energy >= 2 then OpenGate;');
        WriteLn('3) if energy = 2 then OpenGate;');
      end;
    2:
      begin
        WriteLn('В архиве хранится карта систем. Пропуска нет, код известен.');
        WriteLn('hasPass = False, knowsCode = True.');
        WriteLn('Правило доступа допускает пропуск ИЛИ код.');
        WriteLn('Лума: «Я нашла запись со способами доступа».');
        WriteLn;
        WriteLn('1) if hasPass and knowsCode then archive := True;');
        WriteLn('2) if not knowsCode then archive := True;');
        WriteLn('3) if hasPass or knowsCode then archive := True;');
      end;
    3:
      begin
        WriteLn('Реле питает Ядро. Нужны заряд не меньше двух И охлаждение.');
        WriteLn('energy = ', State.Energy, ', coolant = True.');
        WriteLn('Лума: «Датчики показывают текущие значения. Решение за тобой».');
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
        WriteLn('Лума: «Здесь нельзя полагаться на непроверенные данные».');
        WriteLn;
        WriteLn('1) Cross; Scan; if Check then MarkRoute;');
        WriteLn('2) if Check then Cross; Scan;');
        WriteLn('3) Scan; if Check then Cross;');
      end;
    5:
      begin
        WriteLn('У Ядра собрались жители. Датчик сообщает: warning = True.');
        WriteLn('При тревоге нужна эвакуация, иначе можно продолжать работу.');
        WriteLn('Лума: «Компьютер выполнит именно записанную ветвь».');
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
  UpdateLeak;
  Correct := Choice = CorrectChoices[Mission];
  if not Correct then Inc(State.Errors);
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

procedure ShowExplanation(Mission: Integer; Correct: Boolean);
begin
  WriteLn;
  if Correct then
    WriteLn('ВЕРНО. Выбрано подходящее правило.')
  else
    WriteLn('ОШИБКА. Аварийный путь позволяет продолжить маршрут.');
  ShowLeakStatus;
  case Mission of
    1:
      begin
        WriteLn('Правильный вариант 2: if energy >= 2 then OpenGate;');
        WriteLn('>= означает «больше или равно». Числа 2 и 3 подходят.');
        WriteLn('Энергия в момент ответа: ', State.Energy, '.');
        if Correct and (State.Energy >= 2) then
          WriteLn('Текущее условие истинно: шлюз открывается.')
        else
          WriteLn('Шлюз пройден через аварийный обход. Мгновенного штрафа нет.');
        if Correct and (State.Energy < 2) then
          WriteLn('Правило верно, но заряда уже мало: energy >= 2 даёт False.');
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
        WriteLn('При energy = 3 и coolant = False выражение с or даст True,');
        WriteLn('хотя охлаждения нет. Выражение с and даст False.');
        WriteLn('Правильное правило должно учитывать и такой случай.');
        if not Correct then
          WriteLn('Аппаратная защита отклонила правило. Реле выключено.')
        else if State.Energy < 2 then
          WriteLn('Правило верно, но заряда уже меньше 2. Реле выключено.');
      end;
    4:
      begin
        WriteLn('Правильный вариант 3: Scan; if Check then Cross;');
        WriteLn('Алгоритм задаёт порядок. Check использует данные Scan,');
        WriteLn('а Cross выполняется только при успешной проверке Check.');
        if not Correct then
          WriteLn('Аварийная платформа помогла пройти. Основной мост закрыт.');
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
  WriteLn('Итоговое состояние:');
  ShowState(State);
end;

function SelectEnding(const State: TState; Mode: Integer): TEnding;
begin
  if State.Energy <= 0 then
    Result := edEnergy
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
        WriteLn('Архив возвращает адреса, мост принимает пешеходов,');
        WriteLn('трамваи возвращаются на линии. Жители уже в безопасности.');
        WriteLn;
        WriteLn('На площади открываются магазины. Утренние трамваи');
        WriteLn('проходят через весь город без остановок. Жители');
        WriteLn('возвращаются домой. Ветвление встречает новый день.');
      end;
    edPartial:
      begin
        WriteLn('КОНЦОВКА: Свет в одном окне');
        WriteLn;
        WriteLn('Ядро запускается тихо. Свет возвращается в больницу');
        WriteLn('и жилой квартал. Несколько районов остаются на резерве.');
        WriteLn('Дежурные открывают временные пункты помощи и раздают карты.');
        WriteLn;
        WriteLn('В доме напротив загорается одно окно. Работы продолжаются');
        WriteLn('вручную, дом за домом. Город живёт на частично');
        WriteLn('восстановленных линиях.');
      end;
    edVoice:
      begin
        WriteLn('КОНЦОВКА: Голос города');
        WriteLn;
        WriteLn('Голос Лумы звучит из городских динамиков. Она распределяет');
        WriteLn('питание и открывает безопасные маршруты. Её слышно');
        WriteLn('на остановках, в больницах и на городских площадях.');
        WriteLn;
        WriteLn('Трамваи получают новые маршруты, кварталы - электричество.');
        WriteLn('Городское управление переходит к Луме. Её голос остаётся');
        WriteLn('с жителями от раннего утра до поздней ночи.');
      end;
    edSafe:
      begin
        WriteLn('КОНЦОВКА: Аварийный рассвет');
        WriteLn;
        WriteLn('Ядро сохраняет журнал и последовательно отключает команды.');
        WriteLn('Независимые аварийные лампы освещают выходы. Ремонтные');
        WriteLn('бригады получают карту повреждений и выходят на улицы.');
        WriteLn;
        WriteLn('Полного запуска не случилось. Трамваи остаются на станциях,');
        WriteLn('дежурные открывают переходы вручную. Город встречает утро');
        WriteLn('на аварийном освещении и ручном управлении.');
      end;
    edPause:
      begin
        WriteLn('КОНЦОВКА: Город потерян');
        WriteLn;
        WriteLn('Ядро разрушено. Резервные линии обрываются одна за другой.');
        WriteLn('Трамваи остаются на путях, насосные станции замолкают.');
        WriteLn('Связь между кварталами исчезает. Восстановление невозможно.');
        WriteLn;
        WriteLn('Жители покидают Ветвление по последнему открытому маршруту.');
        WriteLn('Пустые улицы уходят под тень неподвижных башен.');
        WriteLn('Дома, данные и привычная жизнь утрачены безвозвратно.');
        WriteLn('Город потерян. Всё, что связывало его воедино, исчезло.');
      end;
    edEnergy:
      begin
        WriteLn('КОНЦОВКА: Город без энергии');
        WriteLn;
        WriteLn('Последний импульс гаснет. Городские экраны темнеют');
        WriteLn('один за другим. Пульт перестаёт принимать команды.');
        WriteLn('Независимые аварийные фонари освещают выходы.');
        WriteLn;
        WriteLn('Лума не на связи. Центральное управление больше');
        WriteLn('не действует. Над остановившимся городом наступает тишина.');
      end;
  end;
  WriteLn('============================================================');
end;

procedure PlayRoute;
var
  Journal: TJournal;
  Mission, Choice, Mode: Integer;
  Action: string;
begin
  LeakActive := False;
  LeakClosed := False;
  LeakDetected := True;
  ValveClosed := False;
  InitState(State);
  ShowIntroduction;
  WriteLn;
  WriteLn('Исходное состояние:');
  ShowState(State);
  StartLeak;
  RepairTerminal;
  for Mission := 1 to MissionCount do
  begin
    UpdateLeak;
    ShowMission(Mission, State);
    ShowLeakStatus;
    Choice := ReadChoice('Ваш вариант (1-3): ', 1, 3);
    ApplyAnswer(Mission, Choice, State, Journal);
    ShowExplanation(Mission, Journal[Mission].Correct);
    WriteLn('Состояние после решения:');
    ShowState(State);
    if Mission < MissionCount then
      ReadInput('Нажмите Enter для перехода к следующему этапу: ');
    UpdateLeak;
  end;
  ShowJournal(Journal, State);
  WriteLn;
  WriteLn('ФИНАЛЬНАЯ КОМАНДА');
  ShowLeakStatus;
  WriteLn('mode = 1: управление людьми, 2: управление Лумой, 3: остановка.');
  WriteLn('1) mode := 1;');
  WriteLn('2) mode := 2;');
  WriteLn('3) mode := 3;');
  Mode := ReadChoice('Выберите режим (1-3): ', 1, 3);
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
end;

procedure PlayGame;
begin
  try
    PlayRoute;
  except
    on E: System.InvalidOperationException do
    begin
      if E.Message <> 'ENERGY_DEPLETED' then raise;
      LeakActive := False;
      WriteLn;
      WriteLn('Итоговое состояние:');
      ShowState(State);
      ShowEnding(edEnergy);
    end;
  end;
end;

begin
  Clock := new System.Diagnostics.Stopwatch;
  Clock.Start;
  System.Console.OutputEncoding := new System.Text.UTF8Encoding(false);
  System.Console.InputEncoding := new System.Text.UTF8Encoding(false);

  repeat
    PlayGame;
    WriteLn;
    WriteLn('1) Сыграть снова   2) Выйти');
    if ReadChoice('Выбор (1-2): ', 1, 2) = 2 then
      Break;
  until False;
  WriteLn('Сеанс завершён.');
end.
