'use client';

/**
 * TradePanel.tsx - P2P 건물 거래소 패널
 * 우측 슬라이드, 다크 테마
 */

import { useState } from 'react';
import { X, Coins, ArrowRightLeft, ShoppingCart, History, Percent, Building2 } from 'lucide-react';

// 거래 탭 타입
type TradeTab = 'sell' | 'buy' | 'history';

// 매도 주문 임시 데이터 타입
interface ISellOrder {
  id: string;
  buildingId: string;
  buildingName: string;
  seller: string;
  price: number;
  listedAt: string;
}

// 거래 기록 타입
interface ITradeRecord {
  id: string;
  buildingName: string;
  price: number;
  buyer: string;
  seller: string;
  completedAt: string;
}

interface ITradePanelProps {
  isOpen: boolean;
  onClose: () => void;
  mcBalance: number;
  onTradeOrder: (buildingId: string, orderType: 'sell' | 'buy', price: number) => void;
}

// 수수료율 상수
const SELL_FEE_RATE = 0.10; // 매도 수수료 10%
const BUY_FEE_RATE = 0.05;  // 매수 수수료 5%

// 임시 소유 건물 목록 (서버 연동 전)
const MOCK_MY_BUILDINGS = [
  { id: 'bld_001', name: 'Seoul Tower Lv.3' },
  { id: 'bld_002', name: 'Gangnam Office Lv.5' },
  { id: 'bld_003', name: 'Itaewon Shop Lv.2' },
];

// 임시 활성 매도 주문
const MOCK_SELL_ORDERS: ISellOrder[] = [
  { id: 'ord_1', buildingId: 'bld_101', buildingName: 'Shibuya Tower Lv.4', seller: 'Player_A', price: 25000, listedAt: '2m ago' },
  { id: 'ord_2', buildingId: 'bld_102', buildingName: 'NYC Office Lv.6', seller: 'Player_B', price: 80000, listedAt: '15m ago' },
  { id: 'ord_3', buildingId: 'bld_103', buildingName: 'London Pub Lv.1', seller: 'Player_C', price: 5000, listedAt: '1h ago' },
];

// 임시 거래 기록
const MOCK_HISTORY: ITradeRecord[] = [
  { id: 'tx_1', buildingName: 'Berlin Lab Lv.3', price: 30000, buyer: 'You', seller: 'Player_D', completedAt: '3h ago' },
  { id: 'tx_2', buildingName: 'Paris Cafe Lv.2', price: 12000, buyer: 'Player_E', seller: 'You', completedAt: '1d ago' },
];

const TAB_CONFIG: { key: TradeTab; label: string; icon: React.ReactNode }[] = [
  { key: 'sell', label: 'Sell', icon: <ArrowRightLeft size={14} /> },
  { key: 'buy', label: 'Buy', icon: <ShoppingCart size={14} /> },
  { key: 'history', label: 'History', icon: <History size={14} /> },
];

export default function TradePanel({ isOpen, onClose, mcBalance, onTradeOrder }: ITradePanelProps) {
  const [tab, setTab] = useState<TradeTab>('sell');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  // 매도 수수료 계산
  const sellFee = sellPrice ? Math.floor(Number(sellPrice) * SELL_FEE_RATE) : 0;
  const sellNet = sellPrice ? Number(sellPrice) - sellFee : 0;

  // 매도 등록 핸들러
  const handleList = () => {
    if (!selectedBuilding || !sellPrice || Number(sellPrice) <= 0) return;
    onTradeOrder(selectedBuilding, 'sell', Number(sellPrice));
    setSelectedBuilding('');
    setSellPrice('');
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 z-20 w-full sm:w-[380px] md:w-[420px] pointer-events-auto">
      <div className="h-full flex flex-col bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-md border-l border-slate-700/50 shadow-[-4px_0_30px_rgba(0,0,0,0.5)]">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-amber-900/40 to-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-amber-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">TRADE EXCHANGE</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-600/60 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Coins size={12} className="text-yellow-400" />
            <span>Balance: <span className="text-yellow-300 font-medium">{mcBalance.toLocaleString()} MC</span></span>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex-shrink-0 flex border-b border-slate-700/50">
          {TAB_CONFIG.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-900/10'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Sell 탭 */}
          {tab === 'sell' && (
            <div className="space-y-3">
              {/* 건물 선택 드롭다운 */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Select Building</label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">-- Choose a building --</option>
                  {MOCK_MY_BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* 매도가 입력 */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Asking Price (MC)</label>
                <input
                  type="number"
                  min={1}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* 수수료 미리보기 */}
              {sellPrice && Number(sellPrice) > 0 && (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase">
                    <Percent size={10} />
                    Fee Preview
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Seller Fee (10%)</span>
                    <span className="text-red-400">-{sellFee.toLocaleString()} MC</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-700/40 pt-1">
                    <span className="text-slate-300 font-medium">You Receive</span>
                    <span className="text-emerald-400 font-bold">{sellNet.toLocaleString()} MC</span>
                  </div>
                </div>
              )}

              {/* List 버튼 */}
              <button
                onClick={handleList}
                disabled={!selectedBuilding || !sellPrice || Number(sellPrice) <= 0}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                  selectedBuilding && sellPrice && Number(sellPrice) > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_2px_0_#92400e] active:shadow-none active:translate-y-0.5'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                List for Sale
              </button>
            </div>
          )}

          {/* Buy 탭 */}
          {tab === 'buy' && (
            <div className="space-y-2">
              {MOCK_SELL_ORDERS.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-8">No active listings</div>
              )}
              {MOCK_SELL_ORDERS.map((order) => {
                const buyFee = Math.floor(order.price * BUY_FEE_RATE);
                const totalCost = order.price + buyFee;
                const canAfford = mcBalance >= totalCost;
                return (
                  <div key={order.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center text-amber-400">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div className="text-white text-sm font-semibold">{order.buildingName}</div>
                          <div className="text-slate-500 text-[10px]">by {order.seller} | {order.listedAt}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-yellow-400 font-medium">{order.price.toLocaleString()}</span>
                        <span className="text-slate-500"> + </span>
                        <span className="text-red-400">{buyFee.toLocaleString()} fee</span>
                      </div>
                      <button
                        onClick={() => canAfford && onTradeOrder(order.buildingId, 'buy', order.price)}
                        disabled={!canAfford}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          canAfford
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_0_#065f46] active:shadow-none active:translate-y-0.5'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Buy ({totalCost.toLocaleString()})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* History 탭 */}
          {tab === 'history' && (
            <div className="space-y-2">
              {MOCK_HISTORY.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-8">No trade history</div>
              )}
              {MOCK_HISTORY.map((tx) => (
                <div key={tx.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-medium">{tx.buildingName}</div>
                    <div className="text-slate-500 text-[10px]">{tx.buyer} ← {tx.seller} | {tx.completedAt}</div>
                  </div>
                  <div className="text-yellow-400 text-xs font-bold">{tx.price.toLocaleString()} MC</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단: 수수료 안내 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Seller fee: 10% | Buyer fee: 5%</span>
            <span className="text-slate-600">P2P Exchange</span>
          </div>
        </div>
      </div>
    </div>
  );
}
