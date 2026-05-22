# Privacy Policy for AI Prompt Refinement Extension ✨

*Last Updated: May 22, 2026*

The **AI Prompt Refinement** extension is built with a zero-tracking, zero-intermediary architecture. We believe that your prompts and credentials belong entirely to you. Any information or settings you manage within the extension remain 100% inside your local browser context.

---

## 🔒 Privacy Commitment at a Glance
* **Zero Accounts:** No registration or accounts required.
* **Zero Tracking:** No telemetry, analytics trackers, or monitoring tools.
* **Direct Access:** All AI improvements are fetched directly from official AI provider endpoints (Google, OpenAI, Anthropic). No intermediary servers ever touch your keys or text.

---

## 1. Information We Collect
We do **not** collect, scrape, or transmit any personally identifiable information (PII) or usage telemetry. 
* We do not collect your name, email address, IP address, browser history, or metadata.
* Your chat interactions and optimized prompts are processed purely for functional enhancement and are never stored or transmitted by us.

## 2. Local Storage and Chrome Synchronization
To provide a seamless experience, all configurations are saved securely inside your browser's private sandboxed profile:
* **API Credentials:** Your Google Gemini, OpenAI, and Anthropic API keys are saved locally.
* **Settings & Templates:** Your active model choice, active provider, custom rules, and favorite saved prompts are stored locally.
* **Sync Support:** The extension uses Chrome's native security API (`chrome.storage.sync`) to securely sync your prompt library and configurations across devices where you are logged into your Google Account. None of this data is visible to us or stored on third-party servers.

## 3. Third-Party API Integrations
When you refine prompts, the extension acts as a secure direct bridge:
* The background service worker sends standard HTTPS requests directly to the official AI endpoint of the provider you configured:
  * **Google Gemini:** `https://generativelanguage.googleapis.com`
  * **OpenAI:** `https://api.openai.com`
  * **Anthropic Claude:** `https://api.anthropic.com`
* These requests use your personal API keys and are sent straight to the provider's server. Your data never goes to a proxy or third-party server.
* Please consult the respective privacy policies of your selected AI providers (Google, OpenAI, and Anthropic) to understand how they treat prompts submitted via API.

## 4. Security Framework
The extension strictly conforms to the security rules of **Chrome Manifest V3**:
* We do not include any remote execution scripts, avoiding arbitrary remote code vulnerabilities.
* The content scripts run inside secure isolated environments, preventing external cross-site scripting (XSS) leaks.

## 5. Controlling Your Data
You have complete control over all data stored by the extension:
* **Edit/Clear:** You can modify or delete your API keys and saved prompt history at any time from the popup or options dashboard.
* **Total Wiping:** Uninstalling the extension from your Google Chrome browser instantly and permanently purges all local data, settings, and keys from your device.

## 6. Contact and Support
If you have any questions or feedback regarding this Privacy Policy, please open an issue in the [Official GitHub Repository](https://github.com/oasissan/prompt_enhancer).
