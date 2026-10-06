import { GoToJSWAProto } from '@waha/core/engines/gows/waproto';
import * as lodash from 'lodash';

import { extractReply } from './reply';

import gowsButtons = require('./__fixtures__/reply/gows.buttons_response.json');
import gowsList = require('./__fixtures__/reply/gows.list_response.json');
import gowsTemplate = require('./__fixtures__/reply/gows.template_button_reply.json');
import interactive = require('./__fixtures__/reply/interactive_response.synthetic.json');
import nowebButtons = require('./__fixtures__/reply/noweb.buttons_response.handmade.json');
import nowebList = require('./__fixtures__/reply/noweb.list_response.handmade.json');
import nowebTemplate = require('./__fixtures__/reply/noweb.template_button_reply.handmade.json');

function logger() {
  return { warn: jest.fn(), debug: jest.fn() };
}

const shapes = [
  {
    name: 'GOWS',
    buttons: GoToJSWAProto(gowsButtons),
    template: GoToJSWAProto(gowsTemplate),
    list: GoToJSWAProto(gowsList),
    interactive: GoToJSWAProto(interactive),
  },
  {
    name: 'NOWEB',
    buttons: nowebButtons,
    template: nowebTemplate,
    list: nowebList,
    // Baileys proto already uses camelCase "paramsJson"
    interactive: GoToJSWAProto(interactive),
  },
];

describe('extractReply', () => {
  describe.each(shapes)('$name', (shape) => {
    it('buttonsResponseMessage', () => {
      expect(extractReply(shape.buttons)).toEqual({
        type: 'button',
        id: 'like',
        text: 'Gostei',
        source: 'buttons_response',
      });
    });

    it('templateButtonReplyMessage', () => {
      expect(extractReply(shape.template)).toEqual({
        type: 'button',
        id: 'fix_a',
        text: 'Fix A',
        index: 0,
        source: 'template_button_reply',
      });
    });

    it('listResponseMessage', () => {
      expect(extractReply(shape.list)).toEqual({
        type: 'list',
        id: 'pz_marg',
        text: 'Margherita',
        description: 'Molho, mussarela, manjericão',
        source: 'list_response',
      });
    });

    it('interactiveResponseMessage', () => {
      const log = logger();
      expect(extractReply(shape.interactive, log)).toEqual({
        type: 'native_flow',
        id: 'confirm',
        text: 'Confirmar',
        source: 'interactive_response',
        params: { id: 'confirm', display_text: 'Confirmar' },
      });
      expect(log.debug).toHaveBeenCalledWith({
        event: 'reply.interactive_response_seen',
      });
    });

    it('does not mutate input', () => {
      for (const message of [
        shape.buttons,
        shape.template,
        shape.list,
        shape.interactive,
      ]) {
        const clone = lodash.cloneDeep(message);
        extractReply(message, logger());
        expect(message).toEqual(clone);
      }
    });
  });

  it('reads nested oneof response.selectedDisplayText', () => {
    const message = {
      buttonsResponseMessage: {
        selectedButtonId: 'like',
        response: { selectedDisplayText: 'Gostei' },
      },
    };
    expect(extractReply(message)?.text).toBe('Gostei');
  });

  it('unwraps container messages', () => {
    const message = {
      ephemeralMessage: {
        message: {
          viewOnceMessageV2: { message: GoToJSWAProto(gowsButtons) },
        },
      },
    };
    expect(extractReply(message)?.id).toBe('like');
  });

  it('returns null for plain text', () => {
    const log = logger();
    expect(extractReply({ conversation: 'hello' }, log)).toBeNull();
    expect(extractReply(null, log)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('does not throw on invalid paramsJson', () => {
    const message = {
      interactiveResponseMessage: {
        body: { text: 'Confirmar' },
        nativeFlowResponseMessage: { paramsJson: '{not json' },
      },
    };
    expect(extractReply(message)).toEqual({
      type: 'native_flow',
      id: null,
      text: 'Confirmar',
      source: 'interactive_response',
      params: null,
    });
  });

  it('warns on unknown response format', () => {
    const log = logger();
    const message = { fooResponseMessage: { someId: 'x' } };
    expect(extractReply(message, log)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith({
      event: 'reply.unknown_format',
      keys: ['fooResponseMessage'],
    });
  });

  it('does not warn on event responses', () => {
    const log = logger();
    const message = { encEventResponseMessage: { encPayload: 'x' } };
    expect(extractReply(message, log)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });
});
