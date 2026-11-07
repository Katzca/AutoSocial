// Localized third-party platform labels used only for browser automation selectors.
const LABELS = {
  create: ["create", "erstellen", "oluştur"],
  instagramPostFormat: ["post", "beitrag", "gönderi"],
  instagramReelFormat: ["reel", "reels"],
  instagramUploadTrigger: ["from computer", "select from computer", "vom computer", "ausw\u00e4hlen", "bilgisayardan seç", "bilgisayarından seç"],
  next: ["next", "weiter", "ileri", "İleri"],
  captionAttribute: ["caption", "beschreib", "başlık", "açıklama"],
  share: ["share", "post", "publish", "teilen", "posten", "paylaş"],
  posted: ["shared", "posted", "geteilt", "ver\u00f6ffentlicht", "beitrag wurde geteilt", "paylaşıldı"],
  error: ["error", "failed", "couldn't", "fehler", "nicht m\u00f6glich", "konnte nicht", "hata", "başarısız"],

  youtubeCreate: ["create", "erstellen", "oluştur"],
  youtubeUploadVideo: ["upload videos", "upload video", "videos hochladen", "video hochladen", "video yükle", "videoları yükle"],
  youtubeSelectFiles: ["select files", "dateien ausw\u00e4hlen", "dosya seç", "dosyaları seç"],
  youtubeTitleAttribute: ["title", "titel", "başlık"],
  youtubeDescriptionAttribute: ["description", "beschreibung", "açıklama"],
  youtubeNotMadeForKids: [
    "not made for kids",
    "nicht fur kinder",
    "nicht f\u00fcr kinder",
    "nicht speziell fur kinder",
    "nicht speziell f\u00fcr kinder", "hayır, çocuklara özel değil", "çocuklara özel değil"],
  youtubePublic: ["public", "\u00f6ffentlich", "herkese açık"],
  youtubePrivate: ["private", "privat", "gizli"],
  youtubeUnlisted: ["unlisted", "nicht gelistet", "listelenmemiş"],
  youtubePublish: ["publish", "ver\u00f6ffentlichen", "yayınla", "yayımla"],
  youtubeSave: ["save", "speichern", "kaydet"],
  youtubePublished: ["published", "processing", "ver\u00f6ffentlicht", "verarbeitet", "yayınlandı", "yayımlandı", "işleniyor", "kaydedildi", "planlandı", "scheduled"],

  instagramCreateIcon: ["New post", "Create", "Yeni gönderi", "Oluştur"],
  instagramPostMenuItem: ["post", "gönderi", "beitrag"],
  instagramNotNow: ["not now", "şimdi değil", "jetzt nicht"],
  instagramOk: ["ok", "tamam"],
  instagramCropIcon: ["Select crop", "Kırpmayı seç"],
  instagramCropOriginal: ["original", "orijinal"],
  instagramCoverFromComputer: ["select from computer", "bilgisayardan seç"],

  youtubeUploading: ["yüklenme yüzdesi", "uploading", "hochgeladen"],
  youtubeScheduleButton: ["planla", "schedule"],

  tiktokNotNow: ["not now", "şimdi değil"],
  tiktokDeclineCookies: ["decline optional cookies", "isteğe bağlı çerezleri reddet"],
  tiktokContentChecksHeading: ["Turn on automatic content checks", "otomatik içerik kontrol"],
  tiktokContentChecksText: ["automatic content checks", "otomatik içerik"],
  tiktokDialogCancel: ["Cancel", "İptal", "iptal"],
  tiktokGotIt: ["got it", "anladım"],
  tiktokWhenToPost: ["when to post", "ne zaman paylaşılsın"],
  tiktokEditCover: ["edit cover", "kapağı düzenle"],
  tiktokUploadCover: ["upload cover", "kapak yükle"],
  tiktokCoverSave: ["save", "confirm", "done", "kaydet", "onayla"],
  tiktokDiscardDraft: ["discard", "sil", "vazgeç"],
  tiktokScheduleButton: ["schedule", "planla"],

  tiktokSearchSounds: ["Search sounds", "Sounds suchen"],
  tiktokEdit: ["edit", "bearbeiten"],
  tiktokSounds: ["sound", "sounds", "audio"],
  tiktokText: ["text"],
  tiktokSave: ["Save", "Speichern"],
  tiktokCancel: ["Cancel", "Abbrechen"],
  tiktokShortContentCheck: ["short content check", "kurze inhaltsprufung", "kurze inhaltspr\u00fcfung"],
  tiktokEnable: ["enable", "turn on", "allow", "ok", "einschalten", "aktivieren"],
  tiktokContinue: ["got it", "continue", "verstanden", "weiter", "fortfahren"],
  tiktokLater: ["later", "not now", "skip", "spater", "spaeter", "sp\u00e4ter"],
  tiktokClose: ["cancel", "close", "abbrechen", "schliessen", "schlie\u00dfen"],
  tiktokPublish: ["publish", "post", "ver\u00f6ffentlichen", "veroeffentlichen", "publicar", "publier", "pubblica"],
  tiktokPublished: [
    "published",
    "posted",
    "success",
    "scheduled",
    "ver\u00f6ffentlicht",
    "veroeffentlicht",
    "erfolgreich",
    "geplant",
    "zur prufung eingereicht",
    "zur pr\u00fcfung eingereicht",
  ],
  tiktokFailed: [
    "failed",
    "error",
    "could not",
    "retry",
    "nicht moglich",
    "nicht m\u00f6glich",
    "fehlgeschlagen",
    "erneut versuchen",
  ],
  tiktokConfirm: [
    "publish",
    "post",
    "confirm",
    "continue",
    "ver\u00f6ffentlichen",
    "veroeffentlichen",
    "best\u00e4tigen",
    "bestaetigen",
    "fortfahren",
  ],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function terms(...keys) {
  return keys.flatMap((key) => LABELS[key] || []);
}

function pattern(...keys) {
  const values = terms(...keys);
  if (values.length === 0) {
    throw new Error(`No platform UI labels configured for: ${keys.join(", ")}`);
  }
  return new RegExp(values.map(escapeRegExp).join("|"), "i");
}

function exactPattern(...keys) {
  const values = terms(...keys);
  if (values.length === 0) {
    throw new Error(`No platform UI labels configured for: ${keys.join(", ")}`);
  }
  return new RegExp(`^(?:${values.map(escapeRegExp).join("|")})$`, "i");
}

// Short month names as YouTube Studio shows them in a Turkish account.
const YOUTUBE_SHORT_MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Month names in the TikTok Studio calendar header, indexed by month.
const TIKTOK_MONTHS = [
  ["january", "ocak"], ["february", "şubat"], ["march", "mart"], ["april", "nisan"],
  ["may", "mayıs"], ["june", "haziran"], ["july", "temmuz"], ["august", "ağustos"],
  ["september", "eylül"], ["october", "ekim"], ["november", "kasım"], ["december", "aralık"],
];

function textSelector(selector, ...keys) {
  return terms(...keys)
    .map((value) => `${selector}:has-text("${value.replace(/"/g, '\\"')}")`)
    .join(", ");
}

function attrSelector(selector, attr, ...keys) {
  return terms(...keys)
    .map((value) => `${selector}[${attr}*="${value.replace(/"/g, '\\"')}" i]`)
    .join(", ");
}

module.exports = {
  TIKTOK_MONTHS,
  YOUTUBE_SHORT_MONTHS_TR,
  attrSelector,
  exactPattern,
  pattern,
  terms,
  textSelector,
};
