import { WAMessageReply } from '@waha/structures/reply.dto';

export { WAMessageReply };

interface ReplyLogger {
  warn: (...args: any[]) => any;
  debug: (...args: any[]) => any;
}

const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
];

const REPLY_KEY = /(Response|Reply)Message$/;

// Known response messages that are not button/list clicks (e.g. event RSVP)
const NOT_BUTTON_REPLY = new Set([
  'encEventResponseMessage',
  'eventResponseMessage',
]);

/**
 * Unwraps container messages (ephemeral, view once, device sent...)
 * Same idea as Baileys "extractMessageContent", but dependency-free.
 */
function unwrap(message: any): any {
  let content = message;
  for (let depth = 0; depth < 5 && content; depth++) {
    if (content.deviceSentMessage?.message) {
      content = content.deviceSentMessage.message;
      continue;
    }
    const wrapper = WRAPPERS.find((key) => content[key]?.message);
    if (!wrapper) break;
    content = content[wrapper].message;
  }
  return content;
}

function parseParams(json: any): any {
  if (typeof json !== 'string' || !json) return null;
  try {
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

/**
 * Extracts the user's reply to interactive messages (buttons, lists, native flow).
 * Input must be in camelCase (Baileys proto or GOWS waproto after GoToJSWAProto).
 */
export function extractReply(
  message: any,
  logger?: ReplyLogger,
): WAMessageReply | null {
  const content = unwrap(message);
  if (!content || typeof content !== 'object') return null;

  const buttons = content.buttonsResponseMessage;
  if (buttons?.selectedButtonId) {
    return {
      type: 'button',
      id: buttons.selectedButtonId,
      text:
        buttons.selectedDisplayText ??
        buttons.response?.selectedDisplayText ??
        null,
      source: 'buttons_response',
    };
  }

  const template = content.templateButtonReplyMessage;
  if (template?.selectedId) {
    const reply: WAMessageReply = {
      type: 'button',
      id: template.selectedId,
      text: template.selectedDisplayText ?? null,
      source: 'template_button_reply',
    };
    if (typeof template.selectedIndex === 'number') {
      reply.index = template.selectedIndex;
    }
    return reply;
  }

  const list = content.listResponseMessage;
  if (list?.singleSelectReply?.selectedRowId) {
    const reply: WAMessageReply = {
      type: 'list',
      id: list.singleSelectReply.selectedRowId,
      text: list.title ?? null,
      source: 'list_response',
    };
    if (list.description) {
      reply.description = list.description;
    }
    return reply;
  }

  const interactive = content.interactiveResponseMessage;
  if (interactive) {
    logger?.debug({ event: 'reply.interactive_response_seen' });
    const flow = interactive.nativeFlowResponseMessage;
    const params = parseParams(flow?.paramsJson ?? flow?.paramsJSON);
    return {
      type: 'native_flow',
      id: params?.id ?? null,
      text: interactive.body?.text ?? null,
      source: 'interactive_response',
      params: params,
    };
  }

  const keys = Object.keys(content).filter(
    (key) => REPLY_KEY.test(key) && !NOT_BUTTON_REPLY.has(key),
  );
  if (keys.length > 0) {
    logger?.warn({ event: 'reply.unknown_format', keys: keys });
  }
  return null;
}
