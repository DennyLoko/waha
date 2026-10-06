import * as grpc from '@grpc/grpc-js';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  assertButtonsBody,
  assertJidAllowedForButtons,
  GOWS_BUTTONS_BODY_REQUIRED,
  toInteractiveMessage,
  buttonsSendError,
} from '@waha/core/engines/gows/buttons.gows';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import {
  ButtonType,
  SendButtonsRequest,
} from '@waha/structures/chatting.buttons.dto';

function buildRequest(
  overrides: Partial<SendButtonsRequest> = {},
): SendButtonsRequest {
  const request = new SendButtonsRequest();
  request.chatId = '123@c.us';
  request.body = 'Body text';
  request.buttons = [{ type: ButtonType.REPLY, text: 'Yes', id: 'yes' }];
  return Object.assign(request, overrides);
}

describe('toInteractiveMessage', () => {
  it('maps the 4 button types', () => {
    const request = buildRequest({
      buttons: [
        { type: ButtonType.REPLY, text: 'Reply', id: 'r1' },
        { type: ButtonType.URL, text: 'Site', url: 'https://example.com' },
        { type: ButtonType.CALL, text: 'Call', phoneNumber: '+1234567890' },
        { type: ButtonType.COPY, text: 'Copy', copyCode: '4321' },
      ],
    });

    const result = toInteractiveMessage(request).toObject();

    expect(result.buttons).toMatchObject([
      { reply: { displayText: 'Reply', id: 'r1' } },
      { url: { displayText: 'Site', url: 'https://example.com' } },
      { call: { displayText: 'Call', phoneNumber: '+1234567890' } },
      { copy: { displayText: 'Copy', copyCode: '4321' } },
    ]);
    expect(result.body).toEqual('Body text');
  });

  it('uses empty id for reply button without id', () => {
    const request = buildRequest({
      buttons: [{ type: ButtonType.REPLY, text: 'Reply' }],
    });

    const result = toInteractiveMessage(request);

    expect(result.buttons[0].reply.displayText).toEqual('Reply');
    expect(result.buttons[0].reply.id).toEqual('');
  });

  it('maps header title', () => {
    const request = buildRequest({ header: 'Header' });

    const result = toInteractiveMessage(request);

    expect(result.header.title).toEqual('Header');
    expect(result.header.has_media).toBe(false);
  });

  it('maps headerImage to header.media IMAGE', () => {
    const media = new messages.Media({
      content: Buffer.from('img'),
      mimetype: 'image/jpeg',
      type: messages.MediaType.IMAGE,
    });

    const result = toInteractiveMessage(buildRequest(), media);

    expect(result.has_header).toBe(true);
    expect(result.header.media.type).toEqual(messages.MediaType.IMAGE);
    expect(result.header.media.mimetype).toEqual('image/jpeg');
  });

  it('has no header when neither header nor headerImage given', () => {
    const result = toInteractiveMessage(buildRequest());

    expect(result.has_header).toBe(false);
  });

  it('keeps footer optional', () => {
    const without = toInteractiveMessage(buildRequest());
    expect(without.has_footer).toBe(false);

    const withFooter = toInteractiveMessage(buildRequest({ footer: 'Foot' }));
    expect(withFooter.footer).toEqual('Foot');
  });
});

describe('assertButtonsBody', () => {
  it.each([undefined, '', '   '])(
    'rejects empty body (%p) with 422',
    (body) => {
      const request = buildRequest({ body: body });

      expect(() => assertButtonsBody(request)).toThrow(
        new UnprocessableEntityException(GOWS_BUTTONS_BODY_REQUIRED),
      );
    },
  );

  it('accepts a non-empty body', () => {
    const request = buildRequest();

    expect(() => assertButtonsBody(request)).not.toThrow();
  });
});

describe('assertJidAllowedForButtons', () => {
  it.each([
    '123@s.whatsapp.net',
    '123@lid',
    '123@c.us',
    '120363000000000000@g.us',
  ])('accepts %s', (jid) => {
    expect(() => assertJidAllowedForButtons(jid)).not.toThrow();
  });

  it.each([
    '120363000000000000@newsletter',
    '123@broadcast',
    'status@broadcast',
  ])('rejects %s with 422', (jid) => {
    expect(() => assertJidAllowedForButtons(jid)).toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('buttonsSendError', () => {
  it('maps INVALID_ARGUMENT to 422 with the gows message', () => {
    const error = {
      code: grpc.status.INVALID_ARGUMENT,
      details:
        'interactive: quick_reply cannot be mixed with other button types',
      message: '3 INVALID_ARGUMENT: interactive: ...',
    };
    const mapped = buttonsSendError(error);
    expect(mapped).toBeInstanceOf(UnprocessableEntityException);
    expect(mapped.message).toBe(
      'interactive: quick_reply cannot be mixed with other button types',
    );
  });

  it('falls back to the error message without details', () => {
    const error = { code: grpc.status.INVALID_ARGUMENT, message: 'bad' };
    expect(buttonsSendError(error).message).toBe('bad');
  });

  it('returns other errors unchanged', () => {
    const error = { code: grpc.status.UNAVAILABLE, message: 'down' };
    expect(buttonsSendError(error)).toBe(error);
  });
});
