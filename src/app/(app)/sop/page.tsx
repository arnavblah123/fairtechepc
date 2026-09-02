import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "./PrintButton";

/** One-page printable SOP for the site in-charge. Mirrors docs/SOP.md. */
const ROWS: [string, string, string, string][] = [
  ["8:00 AM", "Take the muster photo of all workers (live camera, location ON). Mark Present / Absent / Half day for everyone. Enter in-time.", "सबकी मस्टर फोटो लें (लाइव कैमरा, लोकेशन चालू)। हर मज़दूर की हाज़िरी लगाएँ। इन-टाइम भरें।", "Attendance / हाज़िरी"],
  ["8:30 AM", "Submit the Daily Plan: per job, per stage, target quantity and manpower for today.", "दैनिक योजना भरें: हर काम, हर स्टेज का आज का लक्ष्य और मज़दूर।", "Daily plan / दैनिक योजना"],
  ["8–10 AM", "Photo 1 of work in progress.", "काम की फोटो 1।", "Photos / फोटो"],
  ["10–12", "Photo 2. Enter consumables issued (electrodes, wheels, gas) against the job.", "फोटो 2। जो सामान निकला वह काम के नाम पर भरें।", "Photos · Consumables"],
  ["12–2 PM", "Photo 3. Assign workers to stages and enter hours.", "फोटो 3। मज़दूरों को स्टेज पर लगाएँ, घंटे भरें।", "Photos · Jobs"],
  ["2–4 PM", "Photo 4. Raise an Issue the moment work stops or material is short.", "फोटो 4। काम रुके या सामान कम हो तो तुरंत समस्या दर्ज करें।", "Photos · Issues"],
  ["4–6 PM", "Photo 5. Enter stage progress: quantity done today and % complete. Enter out-time and OT.", "फोटो 5। स्टेज प्रगति भरें। आउट-टाइम और ओटी भरें।", "Photos · Jobs · Attendance"],
  ["Before 8 PM", "Open DPR, check the auto-filled report, add a short remark, Submit.", "डीपीआर खोलें, रिपोर्ट देखें, छोटी टिप्पणी लिखें, सबमिट करें।", "DPR / डीपीआर"],
];

const RULES: [string, string][] = [
  ["Every photo must be taken live from the camera with location ON. Gallery photos are rejected.", "हर फोटो कैमरे से लाइव, लोकेशन चालू रखकर। गैलरी की फोटो नहीं चलेगी।"],
  ["DPR must be submitted before 8 PM every working day. A missing DPR shows red on the MD's screen.", "डीपीआर रोज़ 8 बजे से पहले। न भेजने पर एमडी की स्क्रीन पर लाल दिखता है।"],
  ["Only today's and yesterday's entries are allowed (yesterday until 10 AM). Older dates need the MD to unlock.", "सिर्फ़ आज और कल की एंट्री (कल की सुबह 10 बजे तक)। पुरानी तारीख के लिए एमडी से अनलॉक कराएँ।"],
  ["Nothing can be bought without approval. Raise a request; buy only after it shows Approved.", "बिना मंज़ूरी कुछ न खरीदें। रिक्वेस्ट डालें; Approved दिखने पर ही खरीदें।"],
  ["Every expense needs a bill photo. No bill, no entry.", "हर खर्च की बिल फोटो ज़रूरी। बिना बिल एंट्री नहीं।"],
  ["Machine breakdown: raise a ticket the same day. When repaired, the person who checked it must sign off.", "मशीन खराब: उसी दिन टिकट बनाएँ। ठीक होने पर जाँचने वाला साइन-ऑफ करे।"],
  ["Work stopped? Raise an Issue with severity Work stopped immediately.", "काम रुका? तुरंत Work stopped समस्या डालें।"],
  ["Green Saved ✓ means it reached the server. If you see red, check internet and try again.", "हरा Saved ✓ मतलब सर्वर तक पहुँच गया। लाल दिखे तो इंटरनेट देखकर दोबारा करें।"],
];

export default function SopPage() {
  return (
    <div className="print:text-[11px]">
      <div className="no-print">
        <PageHeader title="Daily routine (SOP)" hi="रोज़ का काम" back="/more" action={<PrintButton />} />
      </div>
      <article className="rounded-2xl bg-white p-4 shadow-sm print:p-0 print:shadow-none">
        <h1 className="text-lg font-bold">Daily routine in Fairtech Site Manager / ऐप में रोज़ का काम</h1>
        <p className="mb-3 text-sm text-slate-600">For Site In-charge & Supervisors · साइट इंचार्ज और सुपरवाइज़र के लिए</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border p-2">Time / समय</th>
                <th className="border p-2">Do this / यह करें</th>
                <th className="border p-2">Screen / स्क्रीन</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([t, en, hi, screen]) => (
                <tr key={t}>
                  <td className="border p-2 font-semibold whitespace-nowrap">{t}</td>
                  <td className="border p-2">
                    <div>{en}</div>
                    <div className="text-slate-600">{hi}</div>
                  </td>
                  <td className="border p-2">{screen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mt-4 font-bold">Rules / नियम</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {RULES.map(([en, hi]) => (
            <li key={en}>
              <div>{en}</div>
              <div className="text-slate-600">{hi}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm font-semibold">Forgot password? Call Arnav. · पासवर्ड भूल गए? अरनव को फ़ोन करें।</p>
      </article>
    </div>
  );
}
