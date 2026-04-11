<script lang="ts">
  import { resolve } from '$app/paths';

  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { isDark } from '$lib/stores/theme.svelte';
</script>

<Seo
  title="Datenschutzerklärung - Assixx"
  description="Datenschutzerklärung gemäß DSGVO für die Assixx SaaS-Plattform — betrieben durch Simon's Computer Service."
  canonical="https://www.assixx.com/datenschutz"
  noindex={true}
/>

<!-- Navigation -->
<header class="legal-header">
  <a
    href={resolve('/')}
    class="legal-header__logo"
  >
    <img
      src={isDark() ? '/images/logo_darkmode.png' : '/images/logo_lightmode.png'}
      alt="Assixx Logo"
      width="100"
      height="48"
    />
  </a>
  <ThemeToggle />
</header>

<main class="legal-content">
  <div class="legal-hero">
    <div class="legal-hero__overline">
      <div class="legal-hero__line"></div>
      <span class="legal-hero__label">Rechtliches</span>
    </div>
    <h1>Datenschutzerklärung</h1>
  </div>

  <!-- ================================================================== -->
  <!-- 1. Datenschutz auf einen Blick -->
  <!-- ================================================================== -->
  <section>
    <h2>1. Datenschutz auf einen Blick</h2>

    <h3>Allgemeine Hinweise</h3>
    <p>
      Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
      personenbezogenen Daten passiert, wenn Sie diese Website und die Assixx-Plattform nutzen.
      Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
      Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer nachfolgenden
      Datenschutzerklärung.
    </p>

    <h3>Datenerfassung auf dieser Website</h3>
    <p>
      <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />
      Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten
      können Sie dem Abschnitt „Hinweis zur verantwortlichen Stelle" in dieser Datenschutzerklärung entnehmen.
    </p>
    <p>
      <strong>Wie erfassen wir Ihre Daten?</strong><br />
      Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich
      z.&thinsp;B. um Daten handeln, die Sie in ein Registrierungsformular eingeben. Andere Daten werden
      automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst.
      Das sind vor allem technische Daten (z.&thinsp;B. Internetbrowser, Betriebssystem oder Uhrzeit des
      Seitenaufrufs).
    </p>
    <p>
      <strong>Wofür nutzen wir Ihre Daten?</strong><br />
      Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website und der SaaS-Plattform
      sicherzustellen. Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden. Als SaaS-Plattform
      verarbeiten wir darüber hinaus die Daten, die Sie und Ihre Mitarbeiter im Rahmen der Nutzung der
      Plattform eingeben (z.&thinsp;B. Dokumente, Chat-Nachrichten, Schichtpläne).
    </p>
    <p>
      <strong>Welche Rechte haben Sie bezüglich Ihrer Daten?</strong><br />
      Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten
      personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung
      dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können
      Sie diese jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht, unter bestimmten Umständen
      die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht
      Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
    </p>
    <p>
      Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.
    </p>
  </section>

  <!-- ================================================================== -->
  <!-- 2. Hosting -->
  <!-- ================================================================== -->
  <section>
    <h2>2. Hosting</h2>
    <p>
      Wir hosten die Inhalte unserer Website und Plattform bei einem externen Dienstleister
      (Hoster). Die personenbezogenen Daten, die auf dieser Website und Plattform erfasst werden,
      werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v.&thinsp;a. um
      IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten,
      Namen, Websitezugriffe und sonstige Daten, die über eine Website generiert werden, handeln.
    </p>
    <p>
      Der Einsatz des Hosters erfolgt zum Zwecke der Vertragserfüllung gegenüber unseren
      potenziellen und bestehenden Kunden (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer
      sicheren, schnellen und effizienten Bereitstellung unseres Online-Angebots durch einen
      professionellen Anbieter (Art. 6 Abs. 1 lit. f DSGVO).
    </p>
    <p>
      Unser Hoster wird Ihre Daten nur insoweit verarbeiten, wie dies zur Erfüllung seiner
      Leistungspflichten erforderlich ist und unsere Weisungen in Bezug auf diese Daten befolgen.
      Wir haben einen Vertrag über Auftragsverarbeitung (AVV) mit unserem Hoster geschlossen.
    </p>
  </section>

  <!-- ================================================================== -->
  <!-- 3. Allgemeine Hinweise und Pflichtinformationen -->
  <!-- ================================================================== -->
  <section>
    <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>

    <h3>Datenschutz</h3>
    <p>
      Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir
      behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen
      Datenschutzvorschriften sowie dieser Datenschutzerklärung.
    </p>
    <p>
      Wir weisen darauf hin, dass die Datenübertragung im Internet (z.&thinsp;B. bei der
      Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten
      vor dem Zugriff durch Dritte ist nicht möglich.
    </p>

    <h3>Hinweis zur verantwortlichen Stelle</h3>
    <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
    <p>
      <strong>Simon Öztürk</strong><br />
      Simon's Computer Service<br />
      Neustr. 13<br />
      48703 Stadtlohn<br />
      Deutschland
    </p>
    <p>
      Telefon: +49 (0) 2563 900 51 61<br />
      E-Mail: info@scs-technik.de
    </p>
    <p>
      Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam
      mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten
      (z.&thinsp;B. Namen, E-Mail-Adressen o.&thinsp;Ä.) entscheidet.
    </p>

    <h3>Speicherdauer</h3>
    <p>
      Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde,
      verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung
      entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur
      Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich
      zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben (z.&thinsp;B.
      steuer- oder handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall erfolgt die
      Löschung nach Fortfall dieser Gründe.
    </p>

    <h3>Rechtsgrundlagen der Datenverarbeitung</h3>
    <p>
      Soweit wir für Verarbeitungsvorgänge personenbezogener Daten eine Einwilligung einholen, dient
      Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage.
    </p>
    <p>
      Ist die Verarbeitung zur Erfüllung eines Vertrags erforderlich, so basiert die Verarbeitung
      auf Art. 6 Abs. 1 lit. b DSGVO. Dies gilt auch für Verarbeitungsvorgänge, die zur Durchführung
      vorvertraglicher Maßnahmen erforderlich sind — etwa bei der Registrierung eines Testkontos.
    </p>
    <p>
      Ist die Verarbeitung zur Erfüllung einer rechtlichen Verpflichtung erforderlich, basiert sie
      auf Art. 6 Abs. 1 lit. c DSGVO.
    </p>
    <p>
      Ist die Verarbeitung zur Wahrung berechtigter Interessen erforderlich und überwiegen Ihre
      Interessen nicht, basiert sie auf Art. 6 Abs. 1 lit. f DSGVO.
    </p>

    <h3>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
    <p>
      Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie
      können eine bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum
      Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.
    </p>

    <h3>Widerspruchsrecht gegen die Datenerhebung (Art. 21 DSGVO)</h3>
    <p>
      <strong
        >WENN DIE DATENVERARBEITUNG AUF GRUNDLAGE VON ART. 6 ABS. 1 LIT. E ODER F DSGVO ERFOLGT,
        HABEN SIE JEDERZEIT DAS RECHT, AUS GRÜNDEN, DIE SICH AUS IHRER BESONDEREN SITUATION ERGEBEN,
        GEGEN DIE VERARBEITUNG IHRER PERSONENBEZOGENEN DATEN WIDERSPRUCH EINZULEGEN. DIE JEWEILIGE
        RECHTSGRUNDLAGE, AUF DENEN EINE VERARBEITUNG BERUHT, ENTNEHMEN SIE DIESER
        DATENSCHUTZERKLÄRUNG. WENN SIE WIDERSPRUCH EINLEGEN, WERDEN WIR IHRE BETROFFENEN
        PERSONENBEZOGENEN DATEN NICHT MEHR VERARBEITEN, ES SEI DENN, WIR KÖNNEN ZWINGENDE
        SCHUTZWÜRDIGE GRÜNDE FÜR DIE VERARBEITUNG NACHWEISEN, DIE IHRE INTERESSEN, RECHTE UND
        FREIHEITEN ÜBERWIEGEN ODER DIE VERARBEITUNG DIENT DER GELTENDMACHUNG, AUSÜBUNG ODER
        VERTEIDIGUNG VON RECHTSANSPRÜCHEN (WIDERSPRUCH NACH ART. 21 ABS. 1 DSGVO).</strong
      >
    </p>

    <h3>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
    <p>
      Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer
      Aufsichtsbehörde zu. Die für uns zuständige Aufsichtsbehörde ist:
    </p>
    <p>
      Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen<br />
      Kavalleriestr. 2–4<br />
      40213 Düsseldorf<br />
      Telefon: 0211/38424-0<br />
      E-Mail: poststelle@ldi.nrw.de<br />
      Website:
      <a
        href="https://www.ldi.nrw.de/"
        target="_blank"
        rel="noopener noreferrer">www.ldi.nrw.de</a
      >
    </p>

    <h3>Recht auf Datenübertragbarkeit</h3>
    <p>
      Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines
      Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen,
      maschinenlesbaren Format aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten
      an einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar
      ist.
    </p>

    <h3>Auskunft, Berichtigung und Löschung</h3>
    <p>
      Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf
      unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und
      Empfänger und den Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder
      Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten können
      Sie sich jederzeit an uns wenden.
    </p>

    <h3>Recht auf Einschränkung der Verarbeitung</h3>
    <p>
      Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu
      verlangen. Hierzu können Sie sich jederzeit an uns wenden. Das Recht auf Einschränkung der
      Verarbeitung besteht in folgenden Fällen:
    </p>
    <ul>
      <li>
        Wenn Sie die Richtigkeit Ihrer bei uns gespeicherten personenbezogenen Daten bestreiten.
      </li>
      <li>Wenn die Verarbeitung Ihrer personenbezogenen Daten unrechtmäßig geschah/geschieht.</li>
      <li>
        Wenn Sie die Löschung Ihrer personenbezogenen Daten ablehnen und stattdessen die
        Einschränkung verlangen.
      </li>
      <li>
        Wenn der Zweck entfallen ist, Sie die Daten aber zur Geltendmachung von Rechtsansprüchen
        benötigen.
      </li>
    </ul>

    <h3>SSL- bzw. TLS-Verschlüsselung</h3>
    <p>
      Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte
      eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass
      die Adresszeile des Browsers von „http://" auf „https://" wechselt und an dem Schloss-Symbol
      in Ihrer Browserzeile.
    </p>
  </section>

  <!-- ================================================================== -->
  <!-- 4. Datenerfassung auf dieser Website -->
  <!-- ================================================================== -->
  <section>
    <h2>4. Datenerfassung auf dieser Website</h2>

    <h3>Cookies</h3>
    <p>
      Unsere Internetseiten verwenden so genannte „Cookies". Cookies sind kleine Datenpakete und
      richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer
      einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät
      gespeichert.
    </p>

    <h3>Technisch notwendige Cookies</h3>
    <p>
      Wir verwenden ausschließlich technisch notwendige Cookies, die für den Betrieb der Website und
      Plattform erforderlich sind. Es werden keine Tracking- oder Marketing-Cookies eingesetzt.
    </p>
    <p>
      Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung der
      Plattform).
    </p>
    <p>Eingesetzte Cookies:</p>
    <ul>
      <li>
        <strong>Session-Cookies:</strong> Aufrechterhaltung der Sitzung und Anmeldung. Werden nach Schließen
        des Browsers gelöscht.
      </li>
      <li>
        <strong>Authentifizierungs-Cookies (HttpOnly):</strong> Sichere Speicherung des Anmelde-Tokens.
        Nur serverseitig auslesbar, nicht per JavaScript zugänglich.
      </li>
      <li>
        <strong>Theme-Präferenz:</strong> Speichert Ihre Einstellung für Dark/Light Mode (localStorage,
        kein Cookie).
      </li>
    </ul>

    <h3>Server-Log-Dateien</h3>
    <p>
      Der Provider der Seiten erhebt und speichert automatisch Informationen in Server-Log-Dateien,
      die Ihr Browser automatisch übermittelt:
    </p>
    <ul>
      <li>Browsertyp und Browserversion</li>
      <li>Verwendetes Betriebssystem</li>
      <li>Referrer URL</li>
      <li>Hostname des zugreifenden Rechners</li>
      <li>Uhrzeit der Serveranfrage</li>
      <li>IP-Adresse</li>
    </ul>
    <p>
      Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen.
      Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
    </p>

    <h3>Kontaktformular und Registrierung</h3>
    <p>
      Wenn Sie sich bei Assixx registrieren oder uns per Kontaktformular kontaktieren, werden die
      von Ihnen eingegebenen Daten (Firmenname, Name, E-Mail, Telefonnummer) zum Zwecke der
      Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten
      geben wir nicht ohne Ihre Einwilligung weiter.
    </p>
    <p>
      Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. vorvertragliche
      Maßnahmen).
    </p>

    <h3>Cloudflare Turnstile (Spam- und Bot-Schutz)</h3>
    <p>
      Wir nutzen auf unseren Anmelde- und Registrierungsformularen den Bot-Schutz „Turnstile" des
      Anbieters Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA. Turnstile prüft
      automatisiert, ob Eingaben in unseren Formularen von einem Menschen oder von einem
      automatisierten Programm vorgenommen werden, und schützt uns so vor missbräuchlichen
      Zugriffen. Hierzu wird ein technisches Token in Ihrem Browser erzeugt und an Cloudflare
      übermittelt. Dabei werden in der Regel keine Cookies gesetzt und es findet kein
      nutzerbezogenes Tracking statt.
    </p>
    <p>
      Übermittelt werden insbesondere die IP-Adresse, technische Browser-Informationen sowie
      Interaktionsdaten der aktuellen Sitzung. Diese Daten werden ausschließlich zum Schutz unserer
      Formulare vor automatisierten Anfragen genutzt und nicht für Werbe- oder Trackingzwecke
      verwendet. Die Speicherung erfolgt nur für die zur Bot-Abwehr erforderliche Dauer.
    </p>
    <p>
      Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse daran,
      unsere Plattform vor missbräuchlicher automatisierter Ausspähung und vor Brute-Force-Angriffen
      zu schützen. Eine Übermittlung in die USA kann nicht ausgeschlossen werden. Cloudflare ist
      nach dem EU-US Data Privacy Framework zertifiziert. Weitere Informationen zum Datenschutz bei
      Cloudflare finden Sie unter
      <a
        href="https://www.cloudflare.com/privacypolicy/"
        target="_blank"
        rel="noopener noreferrer">https://www.cloudflare.com/privacypolicy/</a
      >.
    </p>
  </section>

  <!-- ================================================================== -->
  <!-- 5. SaaS-Plattform — Datenverarbeitung im Auftrag -->
  <!-- ================================================================== -->
  <section>
    <h2>5. Datenverarbeitung auf der Assixx-Plattform (SaaS)</h2>

    <h3>Assixx als Auftragsverarbeiter</h3>
    <p>
      Assixx ist eine Multi-Tenant SaaS-Plattform für Industrieunternehmen. Wenn Ihr Unternehmen
      (der „Mandant") Assixx nutzt, verarbeiten wir personenbezogene Daten Ihrer Mitarbeiter in
      Ihrem Auftrag. In diesem Fall ist Ihr Unternehmen der Verantwortliche im Sinne der DSGVO, und
      wir handeln als Auftragsverarbeiter gemäß Art. 28 DSGVO.
    </p>
    <p>
      Grundlage hierfür ist ein Vertrag über Auftragsverarbeitung (AVV), der mit jedem Mandanten
      geschlossen wird.
    </p>

    <h3>Kategorien verarbeiteter Daten</h3>
    <p>Im Rahmen der Plattformnutzung werden folgende personenbezogene Daten verarbeitet:</p>
    <ul>
      <li>
        <strong>Stammdaten der Mitarbeiter:</strong> Name, E-Mail, Rolle, Abteilung, Position — eingegeben
        durch den Administrator des Mandanten.
      </li>
      <li>
        <strong>Dokumente:</strong> Hochgeladene Dateien (z.&thinsp;B. Gehaltsabrechnungen, Betriebsanweisungen).
        Zugriff nur für berechtigte Nutzer innerhalb des Mandanten.
      </li>
      <li>
        <strong>Chat-Nachrichten:</strong> 1:1 und Gruppen-Chat. 1:1-Nachrichten sind Ende-zu-Ende-verschlüsselt
        (X25519 + XChaCha20-Poly1305) — der Server kann deren Inhalt nicht lesen.
      </li>
      <li>
        <strong>Arbeitsorganisation:</strong> Schichtpläne, Urlaubsanträge, Arbeitsaufträge, TPM-Checklisten,
        KVP-Vorschläge.
      </li>
      <li>
        <strong>Audit-Log:</strong> Protokollierung sicherheitsrelevanter Aktionen (Anmeldung, Datenänderung,
        Berechtigungsänderung) zu Compliance-Zwecken.
      </li>
    </ul>

    <h3>Mandantenisolierung (Multi-Tenant)</h3>
    <p>
      Die Daten jedes Mandanten sind auf Datenbankebene strikt voneinander getrennt. Wir setzen
      PostgreSQL Row Level Security (RLS) ein — eine technische Maßnahme, die sicherstellt, dass
      Mandant A unter keinen Umständen auf Daten von Mandant B zugreifen kann. Diese Isolierung ist
      in der Datenbank-Engine selbst implementiert und kann nicht durch Anwendungscode umgangen
      werden.
    </p>

    <h3>Ende-zu-Ende-Verschlüsselung (Chat)</h3>
    <p>
      1:1-Chat-Nachrichten werden clientseitig mit X25519-Schlüsselaustausch und
      XChaCha20-Poly1305-Verschlüsselung verschlüsselt. Der private Schlüssel jedes Nutzers
      verbleibt ausschließlich im Browser (IndexedDB). Der Server speichert nur verschlüsselte Daten
      und kann den Klartext nicht rekonstruieren.
    </p>

    <h3>Löschung und Kündigung</h3>
    <p>
      Bei Kündigung eines Mandantenkontos werden sämtliche Daten des Mandanten (Nutzer, Dokumente,
      Chat-Nachrichten, Konfigurationen) vollständig und unwiderruflich gelöscht. Die Löschung
      erfolgt automatisiert durch einen dedizierten Background-Worker.
    </p>
    <p>
      Einzelne Mitarbeiterkonten können jederzeit durch den Administrator des Mandanten deaktiviert
      oder gelöscht werden.
    </p>

    <h3>Datenstandort</h3>
    <p>
      Alle Daten werden auf Servern innerhalb der Europäischen Union gespeichert und verarbeitet.
      Eine Übermittlung in Drittstaaten findet nicht statt.
    </p>
  </section>

  <!-- ================================================================== -->
  <!-- 6. Auftragsverarbeitung -->
  <!-- ================================================================== -->
  <section>
    <h2>6. Auftragsverarbeitung</h2>
    <p>
      Wir haben mit unseren Dienstleistern Verträge über Auftragsverarbeitung (AVV) geschlossen.
      Dies ist ein datenschutzrechtlich vorgeschriebener Vertrag, der gewährleistet, dass diese die
      personenbezogenen Daten unserer Websitebesucher und Plattformnutzer nur nach unseren Weisungen
      und unter Einhaltung der DSGVO verarbeiten.
    </p>
  </section>

  <p class="legal-updated">Stand: April 2026</p>
</main>

<LegalFooter compact />

<style>
  /* Header */
  .legal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 auto;
    border-bottom: var(--glass-border);
    padding: var(--spacing-4) 5%;
    max-width: 1200px;
  }

  .legal-header__logo img {
    display: block;
    width: 100px;
    height: auto;
  }

  /* Content */
  .legal-content {
    margin: 0 auto;
    padding: var(--spacing-8) 5%;
    max-width: 800px;
  }

  /* Hero title section */
  .legal-hero {
    margin-bottom: var(--spacing-8);
  }

  .legal-hero__overline {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: var(--spacing-4);
  }

  .legal-hero__line {
    width: 48px;
    height: 1px;
    background: var(--color-primary);
  }

  .legal-hero__label {
    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .legal-content h1 {
    color: var(--color-text-primary);
    font-weight: 800;
    font-size: 2.25rem;
    letter-spacing: -0.025em;
  }

  @media (width >= 640px) {
    .legal-content h1 {
      font-size: 3rem;
    }
  }

  .legal-content h2 {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-top: var(--spacing-8);
    margin-bottom: var(--spacing-3);
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.25rem;
  }

  .legal-content h2::before {
    flex-shrink: 0;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light));
    width: 4px;
    height: 24px;
    content: '';
  }

  .legal-content h3 {
    margin-top: var(--spacing-6);
    margin-bottom: var(--spacing-2);
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.0625rem;
  }

  .legal-content p {
    margin-bottom: var(--spacing-3);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  .legal-content ul {
    margin-bottom: var(--spacing-3);
    padding-left: var(--spacing-6);
    list-style: disc;
  }

  .legal-content li {
    margin-bottom: var(--spacing-2);
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  .legal-content a {
    color: var(--color-primary);
    text-decoration: none;
  }

  .legal-content a:hover {
    text-decoration: underline;
  }

  .legal-content strong {
    color: var(--color-text-primary);
  }

  .legal-updated {
    margin-top: var(--spacing-8);
    border-top: var(--glass-border);
    padding-top: var(--spacing-6);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    opacity: 70%;
  }

  @media (width < 768px) {
    .legal-content {
      padding: var(--spacing-6) var(--spacing-4);
    }

    .legal-content h1 {
      font-size: 1.5rem;
    }
  }
</style>
