import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  title: string;
  body: string;
  triggerType: string;
  daysBefore: number;
  sendHour: number;
  sendMinute: number;
  asIcon?: boolean;
};

function fill(tpl: string) {
  const sampleDate = new Date();
  sampleDate.setDate(sampleDate.getDate() + 1);
  return (tpl || "")
    .replaceAll("{count}", "3")
    .replaceAll("{total}", "₪ 12,450")
    .replaceAll("{date}", sampleDate.toLocaleDateString("he-IL"));
}

function nextFire(daysBefore: number, hour: number, minute: number, triggerType: string) {
  const now = new Date();
  const at = new Date();
  at.setHours(hour || 0, minute || 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  const eventDate = new Date(at);
  if (triggerType === "checks_due") eventDate.setDate(eventDate.getDate() + (daysBefore || 0));
  return { at, eventDate };
}

export function NotificationSimulator(props: Props) {
  const [playing, setPlaying] = useState(false);
  const { at, eventDate } = nextFire(props.daysBefore, props.sendHour, props.sendMinute, props.triggerType);
  const timeLabel = at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  function play() {
    setPlaying(false);
    requestAnimationFrame(() => setPlaying(true));
    setTimeout(() => setPlaying(false), 4000);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {props.asIcon ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="הדמיית התראה">
            <PlayCircle className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PlayCircle className="w-4 h-4 ml-1" /> הדמיית התראה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>הדמיית ההתראה</DialogTitle>
          <DialogDescription>
            כך תיראה ההתראה במסך הנעילה של הטלפון — ללא צורך במכשיר אמיתי.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-slate-900 p-4 space-y-3">
          <div className="text-center text-slate-300 text-xs">{at.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="text-center text-slate-100 text-4xl font-light tracking-wide">{timeLabel}</div>
          <div
            className={`rounded-xl bg-slate-100/95 p-3 shadow-lg transition-all duration-500 ${
              playing ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-70 scale-[0.98]"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
              <img src="/favicon.svg" alt="" className="w-4 h-4 rounded" />
              <span>מרכז קרלין סטולין</span>
              <span>·</span>
              <span>עכשיו</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">{fill(props.title) || "כותרת ההתראה"}</div>
            <div className="text-xs text-slate-700 mt-0.5 leading-snug">{fill(props.body) || "תוכן ההתראה"}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <span className="font-medium text-foreground">מועד השליחה הקרוב: </span>
            {at.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
          {props.triggerType === "checks_due" && (
            <div>
              <span className="font-medium text-foreground">מתייחס לאירוע בתאריך: </span>
              {eventDate.toLocaleDateString("he-IL")} ({props.daysBefore} ימים מראש)
            </div>
          )}
          <div>הערכים בהדמיה הם לדוגמה בלבד ({"{count}"} = 3, {"{total}"} = ₪ 12,450).</div>
        </div>

        <Button onClick={play}><PlayCircle className="w-4 h-4 ml-1" /> הפעל הדמיה</Button>
      </DialogContent>
    </Dialog>
  );
}
