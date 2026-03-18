export const BASE_PATH =
  process.env.BASE_PATH ??
  (process.env.NODE_ENV === "production"
    ? "/IO-35_appRECORD-NovakivskaSofia-FIOT-2026"
    : "");
