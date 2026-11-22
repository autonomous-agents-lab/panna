import type { Catalogue } from "../catalogue";

/** The Hindi catalogue. Typed as `Catalogue`, so a missing or extra key fails the typecheck. */
export const hi: Catalogue = {
  "home.comingSoon": "जल्द आ रहा है",
  "home.tagline": "सबके लिए एक डिजिटल किताब। अपने विचार हिन्दी या अंग्रेज़ी में, पन्ना-दर-पन्ना लिखिए।",
  "localeSwitch.label": "भाषा",
  "localeSwitch.endonym": "हिन्दी",
  "shell.homeLink": "{appName}, मुखपृष्ठ",
  "shell.skipToContent": "मुख्य सामग्री पर जाएँ",
  "shell.description":
    "सबके लिए एक डिजिटल किताब। हिन्दी या अंग्रेज़ी में पन्ना-दर-पन्ना लिखिए, और पाठकों को असली कॉपी की तरह अपने पन्ने पलटने दीजिए।",
  "shell.footer": "{appName}: सबके लिए एक डिजिटल किताब",
  "notFound.title": "पृष्ठ नहीं मिला",
  "notFound.body": "आप जो पृष्ठ ढूँढ रहे थे, वह हमें नहीं मिला। हो सकता है वह कहीं और चला गया हो, या लिंक ग़लत हो।",
  "notFound.home": "मुखपृष्ठ पर जाएँ",
  "error.title": "कुछ गड़बड़ हो गई",
  "error.body": "यह पृष्ठ दिखाया नहीं जा सका। कृपया फिर से कोशिश करें, या मुखपृष्ठ पर लौटें।",
  "error.retry": "फिर से कोशिश करें",
  "error.home": "मुखपृष्ठ पर जाएँ",
  "username.error.too_short": "यूज़रनेम में कम से कम {min} अक्षर होने चाहिए।",
  "username.error.too_long": "यूज़रनेम में ज़्यादा से ज़्यादा {max} अक्षर हो सकते हैं।",
  "username.error.invalid_characters": "सिर्फ़ अंग्रेज़ी के अक्षर a से z, अंक और अंडरस्कोर (_) इस्तेमाल करें।",
  "username.error.must_start_with_letter": "यूज़रनेम किसी अक्षर से शुरू होना चाहिए।",
  "username.error.reserved": "यह यूज़रनेम आरक्षित है। कृपया कोई दूसरा चुनें।",
  "username.error.held": "यह यूज़रनेम हाल ही में इस्तेमाल हुआ था और अभी उपलब्ध नहीं है।",
  "username.error.taken": "यह यूज़रनेम पहले से किसी ने ले लिया है।",
};
