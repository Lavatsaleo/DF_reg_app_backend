const BASIC_SKILLS_TEST_PASSING_PERCENTAGE = 50;

const basicSkillsTestQuestions = [
  {
    questionCode: "BITS_001",
    questionNumber: 1,
    category: "Device basics",
    questionText: "What is the main purpose of a computer or smartphone operating system?",
    options: [
      { value: "PRINT_ONLY", label: "To print documents only" },
      { value: "MANAGE_DEVICE", label: "To manage the device and help apps run" },
      { value: "CHARGE_BATTERY", label: "To charge the device battery" },
      { value: "BLOCK_INTERNET", label: "To block internet access" },
    ],
    correctAnswer: "MANAGE_DEVICE",
    points: 1,
  },
  {
    questionCode: "BITS_002",
    questionNumber: 2,
    category: "Internet basics",
    questionText: "Which application is commonly used to open websites?",
    options: [
      { value: "CALCULATOR", label: "Calculator" },
      { value: "WEB_BROWSER", label: "Web browser" },
      { value: "CAMERA", label: "Camera" },
      { value: "CLOCK", label: "Clock" },
    ],
    correctAnswer: "WEB_BROWSER",
    points: 1,
  },
  {
    questionCode: "BITS_003",
    questionNumber: 3,
    category: "Email",
    questionText: "What should you normally use the CC field for when sending an email?",
    options: [
      { value: "MAIN_RECIPIENT", label: "The main person expected to respond" },
      { value: "COPY_RECIPIENT", label: "Someone who should receive a copy for information" },
      { value: "PASSWORD", label: "Your email password" },
      { value: "ATTACHMENT_NAME", label: "The name of an attachment" },
    ],
    correctAnswer: "COPY_RECIPIENT",
    points: 1,
  },
  {
    questionCode: "BITS_004",
    questionNumber: 4,
    category: "Files",
    questionText: "What does it mean to upload a file?",
    options: [
      { value: "MOVE_TO_ONLINE_SYSTEM", label: "Move or send a file from your device to an online system" },
      { value: "DELETE_FILE", label: "Delete a file from your device" },
      { value: "PRINT_FILE", label: "Print a file on paper" },
      { value: "TURN_OFF_DEVICE", label: "Turn off the device" },
    ],
    correctAnswer: "MOVE_TO_ONLINE_SYSTEM",
    points: 1,
  },
  {
    questionCode: "BITS_005",
    questionNumber: 5,
    category: "Productivity",
    questionText: "Which keyboard shortcuts are commonly used to copy and paste text on Windows computers?",
    options: [
      { value: "CTRL_C_CTRL_V", label: "Ctrl + C and Ctrl + V" },
      { value: "CTRL_P_CTRL_S", label: "Ctrl + P and Ctrl + S" },
      { value: "ALT_F4", label: "Alt + F4 only" },
      { value: "SHIFT_ENTER", label: "Shift + Enter only" },
    ],
    correctAnswer: "CTRL_C_CTRL_V",
    points: 1,
  },
  {
    questionCode: "BITS_006",
    questionNumber: 6,
    category: "Online safety",
    questionText: "Which password is the strongest option?",
    options: [
      { value: "NAME_123", label: "myname123" },
      { value: "PASSWORD", label: "password" },
      { value: "MIXED_COMPLEX", label: "T7!mango_River#42" },
      { value: "BIRTH_YEAR", label: "1999" },
    ],
    correctAnswer: "MIXED_COMPLEX",
    points: 1,
  },
  {
    questionCode: "BITS_007",
    questionNumber: 7,
    category: "Online safety",
    questionText: "What should you do if you receive a suspicious email asking for your password?",
    options: [
      { value: "REPLY_PASSWORD", label: "Reply with the password quickly" },
      { value: "IGNORE_OR_REPORT", label: "Do not share the password; report or verify the email" },
      { value: "FORWARD_TO_FRIENDS", label: "Forward it to many friends" },
      { value: "CLICK_ALL_LINKS", label: "Click all links to check them" },
    ],
    correctAnswer: "IGNORE_OR_REPORT",
    points: 1,
  },
  {
    questionCode: "BITS_008",
    questionNumber: 8,
    category: "Communication",
    questionText: "In an online meeting, what does the mute button usually do?",
    options: [
      { value: "TURNS_OFF_MIC", label: "Turns off your microphone so others cannot hear you" },
      { value: "TURNS_OFF_SCREEN", label: "Turns off your computer screen" },
      { value: "SENDS_EMAIL", label: "Sends an email" },
      { value: "DELETES_MEETING", label: "Deletes the meeting" },
    ],
    correctAnswer: "TURNS_OFF_MIC",
    points: 1,
  },
  {
    questionCode: "BITS_009",
    questionNumber: 9,
    category: "Internet basics",
    questionText: "What is a search engine used for?",
    options: [
      { value: "FIND_INFORMATION", label: "Finding information on the internet" },
      { value: "CHARGE_PHONE", label: "Charging a phone" },
      { value: "CLEAN_SCREEN", label: "Cleaning a screen" },
      { value: "LOCK_KEYBOARD", label: "Locking a keyboard" },
    ],
    correctAnswer: "FIND_INFORMATION",
    points: 1,
  },
  {
    questionCode: "BITS_010",
    questionNumber: 10,
    category: "Data entry",
    questionText: "When completing an online form, what should you do before pressing Submit?",
    options: [
      { value: "REVIEW_ANSWERS", label: "Review your answers for accuracy" },
      { value: "CLOSE_BROWSER", label: "Close the browser immediately" },
      { value: "SHARE_PASSWORD", label: "Share your password" },
      { value: "DELETE_ATTACHMENTS", label: "Delete required attachments" },
    ],
    correctAnswer: "REVIEW_ANSWERS",
    points: 1,
  },
];

function getPublicBasicSkillsTestQuestions() {
  return basicSkillsTestQuestions.map(({ correctAnswer, ...question }) => question);
}

function getQuestionByCode(questionCode) {
  return basicSkillsTestQuestions.find(
    (question) => question.questionCode === questionCode
  );
}

module.exports = {
  BASIC_SKILLS_TEST_PASSING_PERCENTAGE,
  basicSkillsTestQuestions,
  getPublicBasicSkillsTestQuestions,
  getQuestionByCode,
};
