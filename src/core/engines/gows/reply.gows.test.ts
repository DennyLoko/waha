// Baileys is ESM-only and can't be loaded by jest (CommonJS),
// so we mock it with the pure helpers used by extractBody.
jest.mock('@adiwajshing/baileys', () => {
  const normalizeMessageContent = (content) => {
    for (let i = 0; i < 5 && content; i++) {
      const inner =
        content.ephemeralMessage ||
        content.viewOnceMessage ||
        content.documentWithCaptionMessage ||
        content.viewOnceMessageV2 ||
        content.viewOnceMessageV2Extension ||
        content.editedMessage ||
        content.associatedChildMessage;
      if (!inner) break;
      content = inner.message;
    }
    return content;
  };
  const getContentType = (content) =>
    content
      ? Object.keys(content).find(
          (k) =>
            (k === 'conversation' || k.includes('Message')) &&
            k !== 'senderKeyDistributionMessage',
        )
      : undefined;
  return {
    __esModule: true,
    default: jest.fn(),
    normalizeMessageContent: normalizeMessageContent,
    extractMessageContent: normalizeMessageContent,
    getContentType: getContentType,
    proto: {},
    Browsers: {},
    DisconnectReason: {},
  };
});
jest.mock('@adiwajshing/baileys/lib/Types/LabelAssociation', () => ({
  LabelAssociationType: {},
}));
jest.mock('@adiwajshing/baileys/lib/WABinary/jid-utils', () => ({
  isLidUser: jest.fn(),
}));

import {
  buildReplyFields,
  quotedBody,
} from '@waha/core/engines/gows/reply.gows';
import { GoToJSWAProto } from '@waha/core/engines/gows/waproto';
import { extractBody } from '@waha/core/engines/noweb/session.noweb.core';
import esm from '@waha/vendor/esm';
import * as lodash from 'lodash';

import gowsButtons = require('@waha/core/utils/__fixtures__/reply/gows.buttons_response.json');
import gowsList = require('@waha/core/utils/__fixtures__/reply/gows.list_response.json');
import gowsTemplate = require('@waha/core/utils/__fixtures__/reply/gows.template_button_reply.json');

/**
 * Mobile click with the Go oneof nested in "Response"
 * (no top-level selectedDisplayText) - extractBody returns null for it.
 */
const gowsButtonsNested = {
  buttonsResponseMessage: {
    Response: { SelectedDisplayText: 'Gostei' },
    selectedButtonID: 'like',
    type: 'DISPLAY_TEXT',
  },
};

/**
 * Same steps as WhatsappSessionGoWSCore.toWAMessage for body/reply
 */
function toWAMessageFields(raw: any) {
  const body = extractBody(raw);
  const waproto = GoToJSWAProto(raw);
  return buildReplyFields(waproto, body);
}

const buttonReply = {
  type: 'button',
  id: 'like',
  text: 'Gostei',
  source: 'buttons_response',
};

beforeAll(() => {
  // extractMediaContent uses the dynamically loaded ESM Baileys
  esm.b = jest.requireMock('@adiwajshing/baileys');
});

describe('buildReplyFields', () => {
  it('mobile click (nested oneof) - fills empty body with reply text', () => {
    expect(extractBody(gowsButtonsNested)).toBeFalsy();
    const fields = toWAMessageFields(gowsButtonsNested);
    expect(fields.body).toEqual('Gostei');
    expect(fields.reply).toEqual(buttonReply);
  });

  it('mobile click (captured fixture) - body text, reply id', () => {
    const fields = toWAMessageFields(gowsButtons);
    expect(fields.body).toEqual('Gostei');
    expect(fields.reply).toEqual(buttonReply);
  });

  it('web click (templateButtonReplyMessage) - body unchanged', () => {
    const fields = toWAMessageFields(gowsTemplate);
    expect(fields.body).toEqual('Fix A');
    expect(fields.reply.id).toEqual('fix_a');
    expect(fields.reply.source).toEqual('template_button_reply');
  });

  it('list click (listResponseMessage) - body unchanged', () => {
    const body = extractBody(gowsList);
    expect(body).toBeTruthy();
    const fields = toWAMessageFields(gowsList);
    expect(fields.body).toEqual(body);
    expect(fields.reply.id).toEqual('pz_marg');
    expect(fields.reply.type).toEqual('list');
  });

  it('plain text - no reply key', () => {
    const fields = toWAMessageFields({ conversation: 'hi' });
    expect(fields).toEqual({ body: 'hi' });
    expect('reply' in fields).toBe(false);
  });

  it('null waproto - no reply key', () => {
    const fields = buildReplyFields(null, null);
    expect(fields).toEqual({ body: null });
    expect('reply' in fields).toBe(false);
  });

  it('never overwrites existing body', () => {
    const fields = buildReplyFields(GoToJSWAProto(gowsButtons), 'Existing');
    expect(fields.body).toEqual('Existing');
    expect(fields.reply.id).toEqual('like');
  });

  it('does not mutate input', () => {
    const raw = lodash.cloneDeep(gowsButtonsNested);
    toWAMessageFields(raw);
    expect(raw).toEqual(gowsButtonsNested);
  });
});

describe('quotedBody', () => {
  it('quoted buttonsResponseMessage (nested oneof) - reply text', () => {
    expect(quotedBody(gowsButtonsNested)).toEqual('Gostei');
  });

  it('quoted buttonsResponseMessage (captured fixture) - reply text', () => {
    expect(quotedBody(gowsButtons)).toEqual('Gostei');
  });

  it('quoted text - text', () => {
    expect(quotedBody({ conversation: 'hi' })).toEqual('hi');
  });

  it('quoted unknown - null', () => {
    expect(quotedBody({})).toBeNull();
  });

  it('does not mutate input', () => {
    const raw = lodash.cloneDeep(gowsButtonsNested);
    quotedBody(raw);
    expect(raw).toEqual(gowsButtonsNested);
  });
});
