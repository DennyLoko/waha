import * as grpc from '@grpc/grpc-js';
import { UnprocessableEntityException } from '@nestjs/common';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import {
  isJidBroadcast,
  isJidNewsletter,
  isJidStatusBroadcast,
} from '@waha/core/utils/jids';
import {
  Button,
  ButtonType,
  SendButtonsRequest,
} from '@waha/structures/chatting.buttons.dto';

export const GOWS_BUTTONS_BODY_REQUIRED = 'body is required for GOWS buttons';

/**
 * gows validates the button rules (counts, mixing reply with CTA) and answers
 * INVALID_ARGUMENT - a caller mistake (422), not a server fault.
 * Any other error is returned as is.
 */
export function buttonsSendError(error: any): any {
  if (error?.code === grpc.status.INVALID_ARGUMENT) {
    return new UnprocessableEntityException(error.details ?? error.message);
  }
  return error;
}

/**
 * GOWS sends buttons to direct chats (pn/lid) and groups only.
 */
export function assertJidAllowedForButtons(jid: string) {
  if (
    isJidNewsletter(jid) ||
    isJidStatusBroadcast(jid) ||
    isJidBroadcast(jid)
  ) {
    throw new UnprocessableEntityException(
      `Buttons message can only be sent to a direct message or group chat.`,
    );
  }
}

export function assertButtonsBody(request: SendButtonsRequest) {
  if (!request.body?.trim()) {
    throw new UnprocessableEntityException(GOWS_BUTTONS_BODY_REQUIRED);
  }
}

function toNativeFlowButton(button: Button): messages.NativeFlowButton {
  switch (button.type) {
    case ButtonType.URL:
      return new messages.NativeFlowButton({
        url: new messages.CtaUrlButton({
          displayText: button.text,
          url: button.url,
        }),
      });
    case ButtonType.CALL:
      return new messages.NativeFlowButton({
        call: new messages.CtaCallButton({
          displayText: button.text,
          phoneNumber: button.phoneNumber,
        }),
      });
    case ButtonType.COPY:
      return new messages.NativeFlowButton({
        copy: new messages.CtaCopyButton({
          displayText: button.text,
          copyCode: button.copyCode,
        }),
      });
    case ButtonType.REPLY:
    default:
      return new messages.NativeFlowButton({
        reply: new messages.QuickReplyButton({
          displayText: button.text,
          id: button.id ?? '',
        }),
      });
  }
}

/**
 * Maps the public SendButtonsRequest to the gows InteractiveMessage.
 * Button rules (counts, mixing) are validated by gows itself.
 */
export function toInteractiveMessage(
  request: SendButtonsRequest,
  headerMedia?: messages.Media,
): messages.InteractiveMessage {
  let header: messages.InteractiveHeader | undefined;
  if (request.header || headerMedia) {
    header = new messages.InteractiveHeader({
      title: request.header || undefined,
    });
    if (headerMedia) {
      header.media = headerMedia;
    }
  }
  return new messages.InteractiveMessage({
    header: header,
    body: request.body,
    footer: request.footer || undefined,
    buttons: request.buttons.map(toNativeFlowButton),
  });
}
