import { type SyntheticEvent, useEffect, useRef } from "react";
import { buildInfo, formatBuildVersion } from "../app/buildInfo";

const USAGE_NOTICE_STORAGE_KEY = "g115b-usage-notice-v2-accepted";
const RANDOM_USAGE_NOTICE_PROBABILITY = 0.08;

type UsageNoticeProps = {
  open: boolean;
  onClose: () => void;
};

export function hasAcceptedUsageNotice() {
  return localStorage.getItem(USAGE_NOTICE_STORAGE_KEY) === "true";
}

export function shouldShowUsageNoticeOnStartup() {
  return !hasAcceptedUsageNotice() || Math.random() < RANDOM_USAGE_NOTICE_PROBABILITY;
}

export function UsageNotice({ open, onClose }: UsageNoticeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function acceptNotice() {
    localStorage.setItem(USAGE_NOTICE_STORAGE_KEY, "true");
    onClose();
  }

  function cancelNotice(event: SyntheticEvent<HTMLDialogElement>) {
    if (!hasAcceptedUsageNotice()) {
      event.preventDefault();
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="usage-notice"
      aria-labelledby="usageNoticeTitle"
      aria-describedby="usageNoticeText"
      onCancel={cancelNotice}
    >
      <div className="usage-notice-panel">
        <header className="usage-notice-header">
          <div className="usage-notice-icon" aria-hidden="true">
            !
          </div>
          <div>
            <h2 id="usageNoticeTitle">Wichtiger Hinweis</h2>
            <p className="usage-notice-intro" id="usageNoticeText">
              Bitte lesen und bestätigen Sie vor der Nutzung
            </p>
          </div>
        </header>
        <div className="usage-notice-body">
          <p className="usage-notice-lead">Diese Anwendung ist ein <strong>Hilfsmittel zur Unterstützung des Situationsbewusstseins</strong> des Piloten und dient ausschließlich der allgemeinen Orientierung.</p>
          <div className="usage-notice-sections">
            <section>
              <h3>Keine Entscheidungsgrundlage</h3>
              <p>Die Anwendung darf niemals als alleinige oder primäre Grundlage für fliegerische Entscheidungen verwendet werden. Für alle operativen Entscheidungen sind ausschließlich offizielle Dokumente (AFM/POH, AIP, NOTAM, aktuelle METARs/TAFs) maßgeblich.</p>
            </section>
            <section>
              <h3>Keine Gewähr für Richtigkeit und Vollständigkeit</h3>
              <p>Die bereitgestellten Berechnungen, Daten und Informationen erheben keinen Anspruch auf Richtigkeit, Vollständigkeit oder Aktualität. Berechnungsergebnisse können Abweichungen von den offiziellen Flughandbuch-Werten enthalten.</p>
            </section>
            <section>
              <h3>Teilweise inoffizielle Datenquellen</h3>
              <p>Flugplatzdaten, Wetterdaten und weitere Informationen werden teilweise aus inoffiziellen, nicht zertifizierten Quellen Dritter bezogen. Eine behördliche Prüfung oder Zertifizierung dieser Daten hat nicht stattgefunden.</p>
            </section>
            <section>
              <h3>Verantwortung des Piloten</h3>
              <p>Der verantwortliche Pilot bleibt gemäß § 3 LuftVO (bzw. Art. 8 VO (EU) 2018/1139) zu jeder Zeit allein verantwortlich für die sichere Durchführung des Fluges. Die Nutzung dieser Anwendung entbindet den Piloten in keiner Weise von dieser Verantwortung.</p>
            </section>
            <section>
              <h3>Haftungsausschluss</h3>
              <p>Der Entwickler übernimmt keinerlei Haftung für Schäden, die mittelbar oder unmittelbar durch die Nutzung oder das Vertrauen auf die Ausgaben dieser Anwendung entstehen.</p>
            </section>
            <section className="usage-notice-confirmation-text">
              <p>Durch Tippen auf „Verstanden – Weiter zur App“ bestätigen Sie, dass Sie diesen Hinweis gelesen und verstanden haben.</p>
            </section>
          </div>
        </div>
        <footer className="usage-notice-footer">
          <div
            className="usage-notice-version"
            title={`Commit ${buildInfo.fullCommit}${buildInfo.dirty ? " · lokal verändert" : ""} · Build ${buildInfo.builtAt}`}
          >
            {formatBuildVersion()}
          </div>
          <button
            className="usage-notice-confirm"
            type="button"
            onClick={acceptNotice}
          >
            Verstanden – Weiter zur App
          </button>
        </footer>
      </div>
    </dialog>
  );
}
