'use client';

import { redirect } from 'next/navigation';

/**
 * /economy — 토큰 대시보드로 리디렉트
 */
export default function EconomyPage() {
  redirect('/economy/tokens');
}
