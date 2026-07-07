import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 | Techno Daemon",
  description: "Techno Daemon の利用規約 / Terms of Service"
};

// 制定日
const EFFECTIVE_DATE_JA = "2026年7月7日";
const EFFECTIVE_DATE_EN = "July 7, 2026";

export default function TermsPage() {
  return (
    <main className="legal">
      <Link className="legalBack" href="/">
        ← Techno Daemon
      </Link>

      <article lang="ja">
        <h1>利用規約</h1>
        <p>
          本利用規約(以下「本規約」)は、Silen-S(以下「運営者」)が提供するWebアプリケーション「Techno
          Daemon」(以下「本サービス」)の利用条件を定めるものです。利用者は、本サービスを利用することにより、本規約に同意したものとみなされます。
        </p>

        <h2>第1条(サービス内容)</h2>
        <p>
          本サービスは、ブラウザ上で音楽を自動生成するツールを無償で提供するものです。音声処理は利用者のブラウザ内で行われ、シーケンサーの設定等は利用者の端末(localStorage)にのみ保存されます。
        </p>

        <h2>第2条(生成された音楽の利用)</h2>
        <ol>
          <li>
            利用者は、本サービスで生成した音楽を、商用・非商用を問わず利用(録音、配信、公開、改変等を含む)することができます。
          </li>
          <li>
            前項の利用にあたっては、本サービスにより生成された旨のクレジット表記(例:「Music generated with Techno
            Daemon」)を行うものとします。
          </li>
          <li>生成された音楽の利用に起因する紛争について、運営者は一切の責任を負いません。</li>
        </ol>

        <h2>第3条(AI機能)</h2>
        <ol>
          <li>
            本サービスの一部機能(AIによる曲調変化)では、利用者が入力したテキストがGoogle LLCの提供するGemini
            APIへ送信されます。個人情報、機密情報その他送信に適さない情報を入力しないでください。
          </li>
          <li>AI機能の利用には、Googleが定める利用規約およびポリシーが適用される場合があります。</li>
        </ol>

        <h2>第4条(禁止事項)</h2>
        <p>利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ol>
          <li>本サービスまたは第三者のサーバー・ネットワークに過度な負荷をかけ、または妨害する行為</li>
          <li>本サービスに組み込まれたAPIキーその他の認証情報を抽出し、本サービス外で使用する行為</li>
          <li>法令または公序良俗に違反する行為、およびそれらを目的とした本サービスの利用</li>
          <li>その他、運営者が不適切と合理的に判断する行為</li>
        </ol>

        <h2>第5条(知的財産権)</h2>
        <p>
          本サービスのソースコードは
          <a href="https://github.com/Silen-S/techno-daemon" rel="noreferrer" target="_blank">
            MITライセンス
          </a>
          で公開されています。「Techno Daemon」の名称およびロゴに関する権利は運営者に帰属します。
        </p>

        <h2>第6条(免責事項)</h2>
        <ol>
          <li>
            本サービスは現状有姿で提供され、運営者はその完全性、正確性、有用性、特定目的への適合性等について、いかなる保証も行いません。
          </li>
          <li>
            運営者は、本サービスの利用または利用不能により利用者に生じたいかなる損害についても、責任を負いません。
          </li>
          <li>運営者は、利用者への事前の通知なく、本サービスの内容の変更、提供の中断または終了を行うことができます。</li>
        </ol>

        <h2>第7条(規約の変更)</h2>
        <p>
          運営者は、必要と判断した場合、本規約を変更することができます。変更後の規約は、本サービス上に掲示した時点から効力を生じます。
        </p>

        <h2>第8条(準拠法・管轄)</h2>
        <p>
          本規約は日本法に準拠し、解釈されます。本サービスに関して紛争が生じた場合、運営者の住所地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
        </p>

        <p className="legalDate">制定日: {EFFECTIVE_DATE_JA}</p>
      </article>

      <hr className="legalDivider" />

      <article lang="en">
        <h1>Terms of Service</h1>
        <p>
          These Terms of Service (the &quot;Terms&quot;) set forth the conditions for using the web application
          &quot;Techno Daemon&quot; (the &quot;Service&quot;) provided by Silen-S (the &quot;Operator&quot;). By using
          the Service, you are deemed to have agreed to these Terms.
        </p>

        <h2>1. The Service</h2>
        <p>
          The Service is a free browser-based tool that generates music automatically. Audio processing runs entirely
          in your browser, and sequencer settings are stored only on your device (localStorage).
        </p>

        <h2>2. Use of Generated Music</h2>
        <ol>
          <li>
            You may use music generated with the Service for any purpose, commercial or non-commercial, including
            recording, streaming, publishing, and modification.
          </li>
          <li>
            When doing so, you must include a credit indicating that the music was generated with the Service (e.g.
            &quot;Music generated with Techno Daemon&quot;).
          </li>
          <li>The Operator assumes no responsibility for disputes arising from your use of generated music.</li>
        </ol>

        <h2>3. AI Features</h2>
        <ol>
          <li>
            Some features (AI-driven transformation) send your input text to the Gemini API provided by Google LLC. Do
            not enter personal, confidential, or otherwise sensitive information.
          </li>
          <li>Google&apos;s own terms and policies may apply to the use of AI features.</li>
        </ol>

        <h2>4. Prohibited Conduct</h2>
        <ol>
          <li>Placing excessive load on, or interfering with, the Service or third-party servers and networks</li>
          <li>Extracting API keys or other credentials embedded in the Service and using them outside the Service</li>
          <li>Any use that violates laws or public order and morals</li>
          <li>Any other conduct the Operator reasonably deems inappropriate</li>
        </ol>

        <h2>5. Intellectual Property</h2>
        <p>
          The source code of the Service is published under the{" "}
          <a href="https://github.com/Silen-S/techno-daemon" rel="noreferrer" target="_blank">
            MIT License
          </a>
          . Rights to the name and logo of &quot;Techno Daemon&quot; belong to the Operator.
        </p>

        <h2>6. Disclaimer</h2>
        <ol>
          <li>
            The Service is provided &quot;as is&quot; without warranty of any kind, including completeness, accuracy,
            usefulness, or fitness for a particular purpose.
          </li>
          <li>
            The Operator shall not be liable for any damages arising from the use of, or inability to use, the Service.
          </li>
          <li>The Operator may modify, suspend, or terminate the Service without prior notice.</li>
        </ol>

        <h2>7. Changes to the Terms</h2>
        <p>
          The Operator may amend these Terms when deemed necessary. Amended Terms take effect when posted on the
          Service.
        </p>

        <h2>8. Governing Law and Jurisdiction</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of Japan. Any dispute arising in
          connection with the Service shall be subject to the exclusive jurisdiction of the court having jurisdiction
          over the Operator&apos;s place of residence, as the court of first instance.
        </p>

        <p className="legalDate">Effective date: {EFFECTIVE_DATE_EN}</p>
        <p className="legalNote">
          This English translation is provided for convenience only. The Japanese version shall prevail.
        </p>
      </article>
    </main>
  );
}
