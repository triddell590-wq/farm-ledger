/* Farm Ledger offline label/docket reader (worker).
   Runs Tesseract (tesseract.js-core 5.1.0, LSTM English) entirely on the phone, so it works with no signal.
   The page fetches the engine and English data (stored offline by the service worker) and hands them over. */
let api = null, Core = null;
self.onmessage = async (e) => {
  const { id, type, image, coreUrl, lang } = e.data || {};
  try {
    if (type === "init") {
      if (!api) {
        importScripts(coreUrl);
        Core = await TesseractCore({ TesseractProgress() {} });
        Core.FS.writeFile("./eng.traineddata", new Uint8Array(lang));
        api = new Core.TessBaseAPI();
        if (api.Init(null, "eng", 1) === -1) throw new Error("Tesseract init failed");
        api.SetVariable("tessedit_pageseg_mode", "6"); // one block: keeps each docket row on one line
      }
      self.postMessage({ id, ok: true });
      return;
    }
    if (!api) throw new Error("reader not started");
    Core.FS.writeFile("/input", new Uint8Array(image));
    if (api.SetImageFile(1, 0) === 1) throw new Error("Couldn't read that image");
    api.Recognize(null);
    const text = api.GetUTF8Text();
    api.Clear();
    self.postMessage({ id, ok: true, text });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
