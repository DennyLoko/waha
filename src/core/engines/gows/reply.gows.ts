import { GoToJSWAProto } from '@waha/core/engines/gows/waproto';
import { extractBody } from '@waha/core/engines/noweb/session.noweb.core';
import { extractReply, WAMessageReply } from '@waha/core/utils/reply';

type ReplyLogger = Parameters<typeof extractReply>[1];

/**
 * Adds "reply" (only when present) and fills the empty "body"
 * with the reply text for interactive responses (buttons, lists).
 * Never overwrites an existing body.
 */
export function buildReplyFields(
  waproto: any,
  body: string | null,
  logger?: ReplyLogger,
): { body: string | null; reply?: WAMessageReply } {
  const reply = waproto ? extractReply(waproto, logger) : null;
  const result: { body: string | null; reply?: WAMessageReply } = {
    body: body || (reply?.text ?? body ?? null),
  };
  if (reply) {
    result.reply = reply;
  }
  return result;
}

/**
 * Body of a quoted message (raw GOWS shape), falling back to the reply text
 * when the quoted message is an interactive response.
 */
export function quotedBody(quotedMessage: any): string | null {
  const body = extractBody(quotedMessage);
  if (body) {
    return body;
  }
  return extractReply(GoToJSWAProto(quotedMessage))?.text ?? null;
}
