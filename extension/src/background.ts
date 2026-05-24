import { Template } from './storage';

// Background Service Worker
console.log('Background script initialized.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Prompt Refinement Extension installed.');
});

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (request.action === 'refinePrompt') {
    handleRefinement(request.payload).then(sendResponse).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep the message channel open for async response
  }
});

const promptPlaceholderRegex = /\{\{\s*prompt\s*\}\}|\{\s*prompt\s*\}|%PROMPT%/gi;

function applyTemplateRule(text: string, rule: string): string {
  const trimmedRule = rule?.trim();
  if (!trimmedRule) return text;

  const hasPlaceholder = promptPlaceholderRegex.test(trimmedRule);
  promptPlaceholderRegex.lastIndex = 0;

  if (hasPlaceholder) {
    return trimmedRule.replace(promptPlaceholderRegex, text);
  }

  return `${text}\n\n${trimmedRule}`.trim();
}

async function extractGeminiWebTokens(): Promise<{ at: string; bl: string; sid: string }> {
  const resp = await fetch('https://gemini.google.com/app', {
    credentials: 'include',
    headers: { 'Accept': 'text/html' },
  });
  if (!resp.ok) {
    throw new Error('Could not reach Gemini. Please make sure you are logged into gemini.google.com.');
  }
  const html = await resp.text();
  const at = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/)?.[1];
  const bl = html.match(/"cfb2h"\s*:\s*"([^"]+)"/)?.[1];
  const sid = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/)?.[1];
  if (!at || !bl) {
    throw new Error('Gemini session not found. Please log into gemini.google.com first, then try again.');
  }
  return { at, bl, sid: sid || '' };
}

function parseGeminiWebResponse(rawText: string): string {
  let finalText = '';
  const regex = /^\[\[.*/gm;
  let m;
  while ((m = regex.exec(rawText)) !== null) {
    try {
      const arr = JSON.parse(m[0]);
      if (arr[0]?.[0] === 'wrb.fr' && arr[0]?.[2]) {
        const inner = JSON.parse(arr[0][2]);
        const candidate = inner?.[4]?.[0]?.[1]?.[0];
        if (candidate) finalText = candidate;
      }
    } catch (_) {}
  }
  return finalText;
}

async function handleRefinement(payload: {
  text: string;
  template: Template;
  apiKey?: string;
  provider?: 'gemini' | 'openai' | 'anthropic' | 'gemini-web';
  model?: string;
}) {
  const { text, template, apiKey, provider = 'gemini', model } = payload;

  if (template.type === 'template') {
    // Static template processing (hybrid approach)
    return { success: true, refinedText: applyTemplateRule(text, template.rule) };
  }

  // AI-powered processing
  if (provider === 'gemini-web') {
    try {
      const { at, bl, sid } = await extractGeminiWebTokens();
      const fullPrompt = `You are an expert prompt engineer. Your task is to refine the user's prompt based on the following rule. Do not answer the prompt itself, ONLY output the refined, improved prompt text.\n\nRule: ${template.rule}\n\nOriginal Prompt:\n${text}`;
      const innerReq = [
        [fullPrompt, 0, null, null, null, null, 0],
        ['en'],
        ['', '', '', null, null, null, null, null, null, ''],
      ];
      const fReq = JSON.stringify([null, JSON.stringify(innerReq)]);
      const reqBody = new URLSearchParams({ at, 'f.req': fReq });
      const reqId = Math.floor(Math.random() * 9000000) + 1000000;
      const streamResp = await fetch(
        `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${encodeURIComponent(bl)}&f.sid=${encodeURIComponent(sid)}&hl=en&_reqid=${reqId}&rt=c`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: reqBody.toString(),
          credentials: 'include',
        }
      );
      if (!streamResp.ok) {
        throw new Error(`Gemini Web returned ${streamResp.status}. Make sure you are logged into gemini.google.com.`);
      }
      const rawText = await streamResp.text();
      const refinedText = parseGeminiWebResponse(rawText);
      if (!refinedText) {
        throw new Error('No response from Gemini Web. Make sure you are logged into gemini.google.com.');
      }
      return { success: true, refinedText: refinedText.trim() };
    } catch (error: any) {
      throw new Error(error.message || 'Gemini Web request failed.');
    }
  }

  if (!apiKey) {
    throw new Error('API key is missing for the selected provider.');
  }

  try {
    if (provider === 'gemini') {
      const activeModel = model || 'gemini-3.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
      const systemInstructions = `You are an expert prompt engineer. Your task is to refine the user's prompt based on the following rule. Do not answer the prompt itself, ONLY output the refined, improved prompt text.\n\nRule: ${template.rule}\n\nOriginal Prompt:\n${text}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstructions }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || response.statusText || 'Gemini API request failed.');
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;
      const refinedText = Array.isArray(parts)
        ? parts.map((part: { text?: string }) => part.text).filter(Boolean).join('')
        : undefined;

      if (!refinedText) {
        throw new Error('Unexpected Gemini API response format.');
      }

      return { success: true, refinedText: refinedText.trim() };
    }

    if (provider === 'openai') {
      const activeModel = model || 'gpt-5.5-instant';
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const systemPrompt = `You are an expert prompt engineer. Your task is to refine the user's prompt based on the following rule. Do not answer the prompt itself, ONLY output the refined, improved prompt text.\n\nRule: ${template.rule}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Original Prompt:\n${text}` }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || response.statusText || 'OpenAI API request failed.');
      }

      const data = await response.json();
      const refinedText = data.choices?.[0]?.message?.content;

      if (!refinedText) {
        throw new Error('Unexpected OpenAI API response format.');
      }

      return { success: true, refinedText: refinedText.trim() };
    }

    if (provider === 'anthropic') {
      const activeModel = model || 'claude-opus-4.7';
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const systemPrompt = `You are an expert prompt engineer. Your task is to refine the user's prompt based on the following rule. Do not answer the prompt itself, ONLY output the refined, improved prompt text.\n\nRule: ${template.rule}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: activeModel,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Original Prompt:\n${text}` }
          ],
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || response.statusText || 'Anthropic API request failed.');
      }

      const data = await response.json();
      const refinedText = data.content?.[0]?.text;

      if (!refinedText) {
        throw new Error('Unexpected Anthropic API response format.');
      }

      return { success: true, refinedText: refinedText.trim() };
    }

    throw new Error('Unsupported AI provider configured.');
  } catch (error: any) {
    throw new Error(error.message || 'Network error occurred during prompt refinement.');
  }
}