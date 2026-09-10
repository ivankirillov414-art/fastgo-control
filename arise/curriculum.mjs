// Stable indices 0–36 preserve existing verified Fusion progress.
const fusion = [
  [
    "I · НОВИЧОК",
    "Навигация в CAD",
    "E",
    40,
    "Освой интерфейс Fusion, ViewCube, Orbit, Pan и Zoom.",
    "Создай проект, открой модель и уверенно покажи её сверху, спереди, сбоку и в перспективе.",
    "https://www.autodesk.com/learn/ondemand/tutorial/fusion-360-user-interface-overview?contextId=AP-USER-INTERFACE-OVERVIEW"
  ],
  [
    "I · НОВИЧОК",
    "Примитивы и координаты",
    "E",
    50,
    "Разберись с базовой геометрией и позиционированием.",
    "Создай композицию минимум из 5 простых тел с точным расположением.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "I · НОВИЧОК",
    "Размеры и трансформации",
    "E",
    60,
    "Научись задавать размеры и изменять геометрию предсказуемо.",
    "Сделай деталь 60×40×20 мм и измени ключевой размер так, чтобы модель перестроилась.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "I · НОВИЧОК",
    "Boolean-операции",
    "D",
    80,
    "Освой объединение, вычитание и пересечение тел.",
    "Создай кронштейн минимум с тремя операциями над телами.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "I · НОВИЧОК",
    "Отверстия, фаски, скругления",
    "D",
    90,
    "Освой базовые модификаторы реальной детали.",
    "Создай пластину с отверстиями двух диаметров, фаской и скруглением.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "I · НОВИЧОК",
    "⚔ BOSS I · Реальная деталь",
    "C",
    180,
    "Примени всё изученное без пошаговой инструкции.",
    "Измерь реальную небольшую деталь, смоделируй её, напечатай и проверь посадку.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "Эскизы",
    "D",
    100,
    "Освой Sketch: линии, окружности, профили и плоскости.",
    "Создай три корректных замкнутых эскиза.",
    "https://www.autodesk.com/learn/ondemand/tutorial/sketching-basics-overview"
  ],
  [
    "II · КОНСТРУКТОР",
    "Ограничения эскиза",
    "C",
    120,
    "Размерные и геометрические constraints.",
    "Сделай полностью определённый эскиз.",
    "https://www.autodesk.com/learn/ondemand/tutorial/sketching-basics-overview"
  ],
  [
    "II · КОНСТРУКТОР",
    "Extrude и Revolve",
    "C",
    130,
    "Превращай эскизы в объёмные тела.",
    "Создай одну деталь Extrude и одну Revolve.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "Массивы и зеркалирование",
    "C",
    140,
    "Повторяющиеся и симметричные элементы.",
    "Создай деталь с массивом и зеркальным элементом.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "Оболочки и стенки",
    "C",
    150,
    "Создание полых корпусов.",
    "Спроектируй печатаемый корпус со стенкой 2 мм.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "Резьбы и крепёж",
    "C",
    160,
    "Проектирование винтовых соединений.",
    "Соедини две детали минимум двумя винтами.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "Допуски и посадки",
    "C",
    180,
    "Практические зазоры FDM.",
    "Напечатай тест посадок и зафиксируй рабочий зазор своего принтера.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "II · КОНСТРУКТОР",
    "⚔ BOSS II · Корпус",
    "B",
    350,
    "Полноценный корпус.",
    "Спроектируй, напечатай и собери корпус из двух частей.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Параметры и переменные",
    "B",
    220,
    "Параметрическое управление моделью.",
    "Сделай модель, перестраиваемую тремя параметрами.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Конфигурации",
    "B",
    230,
    "Варианты одной конструкции.",
    "Создай три размера одного изделия.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Сборки",
    "B",
    250,
    "Компоненты и assemblies.",
    "Собери конструкцию минимум из пяти деталей.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Сопряжения и движение",
    "B",
    260,
    "Joints и движение компонентов.",
    "Сделай сборку с рабочей движущейся частью.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Design for FDM",
    "B",
    280,
    "Проектирование под реальную печать.",
    "Оптимизируй деталь под минимум поддержек.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "Прочность геометрии",
    "B",
    300,
    "Рёбра и направления нагрузки.",
    "Усиль нагруженный кронштейн без удвоения массы.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "III · ИНЖЕНЕР",
    "⚔ BOSS III · Механизм",
    "A",
    550,
    "Инженерная сборка.",
    "Создай и напечатай рабочий механизм минимум из пяти деталей.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Reverse engineering",
    "B",
    320,
    "Восстановление реальной геометрии.",
    "Сними размеры и создай цифровую копию предмета.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Сложные поверхности",
    "A",
    350,
    "Loft, Sweep и сложные переходы.",
    "Создай функциональную деталь с двумя сложными поверхностями.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Кабельные каналы",
    "B",
    280,
    "Разводка проводов внутри корпуса.",
    "Создай корпус с каналами и фиксацией проводов.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Крепление электроники",
    "A",
    350,
    "PCB, стойки и разъёмы.",
    "Спроектируй корпус под реальную плату.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Подшипники и валы",
    "A",
    380,
    "Посадки вращающихся узлов.",
    "Создай узел вал + два подшипника + корпус.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Защёлки и петли",
    "A",
    400,
    "Подвижные соединения.",
    "Напечатай рабочую петлю или защёлку.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Обслуживаемость",
    "A",
    420,
    "Проектирование под ремонт.",
    "Сделай ключевой компонент съёмным без разрушения корпуса.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "Итерации прототипа",
    "A",
    450,
    "V1 → анализ → V2.",
    "Создай V1, найди три недостатка и исправь их в V2.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "IV · ADVANCED",
    "⚔ BOSS IV · Модуль",
    "A",
    750,
    "Реальный инженерный модуль.",
    "Разработай новый функциональный модуль существующего устройства.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "Техническое задание",
    "B",
    300,
    "Требования до начала CAD.",
    "Напиши ТЗ на собственное устройство.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "Концепт и архитектура",
    "A",
    400,
    "Компоновка и подсистемы.",
    "Сделай два варианта компоновки устройства.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "CAD полного изделия",
    "A",
    550,
    "Полная цифровая сборка.",
    "Создай CAD-сборку всех основных компонентов.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "Прототип V1",
    "A",
    650,
    "Первое физическое воплощение.",
    "Напечатай и собери V1.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "Испытания",
    "A",
    500,
    "Проверка требований.",
    "Проведи тесты и запиши минимум пять улучшений.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "Версия V2",
    "S",
    900,
    "Переработка конструкции.",
    "Исправь проблемы и собери V2.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ],
  [
    "V · CREATOR",
    "♛ FINAL BOSS · Собственное устройство",
    "S",
    2000,
    "Финальное испытание.",
    "Идея → ТЗ → CAD → V1 → испытания → V2 → рабочее устройство.",
    "https://www.autodesk.com/learn/ondemand/course/learn-fusion-for-cad-in-90-minutes"
  ]
];
export const FUSION = fusion.map((x,id) => ({id,track:'fusion',chapter:x[0],title:x[1],rank:x[2],xp:x[3],description:x[4],mission:x[5],url:x[6]}));
const english=[
 ['I · FOUNDATION','Базовые фразы','E',30,'Приветствие, знакомство и простые вопросы.','Напиши по-английски приветствие, представление себя и три вопроса собеседнику.'],
 ['I · FOUNDATION','50 ключевых слов','E',40,'Собери личный словарь самых нужных слов.','Прикрепи список 50 английских слов с переводом и десять собственных предложений с ними.'],
 ['I · FOUNDATION','Present Simple','E',50,'Расскажи о привычках и обычном дне.','Напиши пять утверждений, пять вопросов и пять отрицаний о своём дне в Present Simple.'],
 ['I · FOUNDATION','Аудирование 1','E',60,'Понимание короткой речи на знакомую тему.','Прослушай урок начального уровня; приложи название урока, ответы на задания и скриншот результата.'],
 ['I · FOUNDATION','Разговор 1','E',60,'Короткое знакомство на английском.','Запиши минутное представление: имя, город, работа, интересы. Приложи аудио или видео и текст речи.'],
 ['I · FOUNDATION','Чтение 1','E',60,'Выделение главной мысли небольшого текста.','Прочитай текст начального уровня. Прикрепи ссылку, краткий пересказ по-английски и пять ответов по содержанию.'],
 ['II · DEVELOPMENT','Грамматика 1','D',80,'Сравни настоящее и прошедшее время.','Напиши по пять предложений в Present Simple, Present Continuous и Past Simple.'],
 ['II · DEVELOPMENT','Разговор 2','D',90,'Повседневная ситуация без готового скрипта.','Запиши двухминутный диалог покупки билета или заказа еды. Прикрепи запись и текст.'],
 ['II · DEVELOPMENT','Аудирование 2','D',90,'Отделяй основные факты от деталей.','После короткого аудиоурока запиши пять услышанных фактов и приложи название урока и результат упражнений.'],
 ['II · DEVELOPMENT','Письмо','D',100,'Понятные сообщения и рабочие письма.','Напиши письмо из 80–100 английских слов: проблема с заказом, факты и желаемое решение.'],
 ['II · DEVELOPMENT','⚔ BOSS · Базовый английский','C',160,'Соедини чтение, письмо и разговор.','Приложи письмо на 100 слов, пересказ короткого текста и двухминутную запись рассказа о своей работе.'],
 ['III · PRACTICE','Технический словарь','C',100,'Язык мастерской, CAD и электроники.','Составь словарь 30 технических слов и напиши десять предложений об инструментах и деталях.'],
 ['III · PRACTICE','Чтение инструкции','C',120,'Работа с оригинальной документацией.','Выбери английскую инструкцию, приложи источник и объясни по-русски пять действий из неё.'],
 ['III · PRACTICE','Разговор о проекте','C',140,'Объясни свою инженерную идею.','Запиши трёхминутный рассказ по-английски: задача, устройство, материалы, результат. Приложи запись и текст.'],
 ['III · PRACTICE','♛ FINAL BOSS · Презентация проекта','B',250,'Самостоятельное общение о реальном проекте.','Подготовь презентацию проекта на английском: описание на 150 слов, иллюстрации и трёхминутную запись выступления.']
];
export const ENGLISH=english.map((x,i)=>({id:37+i,track:'english',chapter:x[0],title:x[1],rank:x[2],xp:x[3],description:x[4],mission:x[5],url:'https://learnenglish.britishcouncil.org/free-resources'}));
export const QUESTS=[...FUSION,...ENGLISH];
export const TRACKS={fusion:{name:'3D DESIGN · FUSION',description:'Урок → реальная деталь → доказательство → следующий уровень.',levelMax:20},english:{name:'ENGLISH · АНГЛИЙСКИЙ',description:'Чтение, письмо, разговор и технический английский.',levelMax:15}};
