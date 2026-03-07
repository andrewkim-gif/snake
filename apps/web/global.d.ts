import en from './messages/en.json';

type Messages = typeof en;

declare global {
  // next-intl: 번역 키 타입 안전성
  interface IntlMessages extends Messages {}
}
