export interface Template {
  id: string;
  name: string;
  description: string;
  rule: string;
  type: 'template' | 'ai';
}

export interface StorageData {
  apiKey: string; // Gemini API Key
  openaiApiKey: string;
  anthropicApiKey: string;
  preferredProvider: 'gemini' | 'openai' | 'anthropic';
  preferredModel: string;
  templates: Template[];
  savedPrompts?: string[];
}

export const DEFAULT_TEMPLATES: Template[] = [
  { id: 'clarity', name: 'Clarity & Structure', description: 'Improve readability and logical flow', rule: 'Rewrite the following prompt to improve its clarity, readability, and logical flow. Ensure the core request remains the same.', type: 'ai' },
  { id: 'detail', name: 'Detail & Specificity', description: 'Add more specific details', rule: 'Expand on the following prompt by asking for specific details, constraints, and edge cases to make the request more robust.', type: 'ai' },
  { id: 'context', name: 'Context & Examples', description: 'Add relevant background context', rule: 'Enhance the following prompt by suggesting the user add relevant background context or providing an example of the desired output format.', type: 'ai' },
  { id: 'professional', name: 'Professional Tone', description: 'Adjust language for professional contexts', rule: 'Rewrite the following prompt to have a formal, authoritative, and professional tone suitable for a business environment.', type: 'ai' },
  { id: 'simplify', name: 'Simplify for Beginners', description: 'Make complex prompts accessible', rule: 'Rewrite the following prompt so that the resulting AI explanation will be easy to understand for a beginner, avoiding jargon.', type: 'ai' },
  { id: 'conciseness', name: 'Conciseness', description: 'Remove unnecessary information', rule: 'Edit the following prompt to be as concise and direct as possible without losing the main objective.', type: 'ai' },
  { id: 'followup', name: 'Add Follow-up Questions', description: 'Include suggested questions', rule: 'Modify the prompt to instruct the AI to also provide 3 relevant follow-up questions at the end of its response.', type: 'ai' },
  { id: 'constraints', name: 'Add Constraints', description: 'Add limitations and boundary conditions', rule: 'Add strict constraints to the following prompt (e.g., word count limits, specific formats to avoid, or structural rules).', type: 'ai' }
];

const DEFAULT_DATA: StorageData = {
  apiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  preferredProvider: 'gemini',
  preferredModel: 'gemini-3.5-flash',
  templates: DEFAULT_TEMPLATES,
  savedPrompts: [],
};

export const getStorageData = (): Promise<StorageData> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'openaiApiKey', 'anthropicApiKey', 'preferredProvider', 'preferredModel', 'templates', 'savedPrompts'], (items) => {
      resolve({ ...DEFAULT_DATA, ...items } as StorageData);
    });
  });
};

export const updateStorageData = (data: Partial<StorageData>): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => {
      resolve();
    });
  });
};