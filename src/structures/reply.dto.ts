export interface WAMessageReply {
  type: 'button' | 'list' | 'native_flow';
  id: string | null;
  text: string | null;
  description?: string;
  index?: number;
  source:
    | 'buttons_response'
    | 'template_button_reply'
    | 'list_response'
    | 'interactive_response';
  params?: any;
}
