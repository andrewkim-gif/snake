'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SK, SKFont, headingFont, bodyFont, sketchBorder, sketchShadow, radius } from '@/lib/sketch-ui';

// --- Types ---

interface MarketSnapshot {
  resource: string;
  price: number;
  prev_price: number;
  price_delta: number;
  volume_24h: number;
  buy_orders: number;
  sell_orders: number;
  high_price_24h: number;
  low_price_24h: number;
}

interface TradeOrder {
  id: string;
  faction_id: string;
  side: 'buy' | 'sell';
  resource: string;
  quantity: number;
  filled: number;
  price_per_unit: number;
  status: string;
  created_at: string;
  expires_at: string;
}

interface TradeExecution {
  id: string;
  buyer_faction: string;
  seller_faction: string;
  resource: string;
  quantity: number;
  price_per_unit: number;
  total_gold: number;
  route_fee: number;
  executed_at: string;
}

// --- Props ---

interface TradeMarketProps {
  serverUrl: string;
  authToken: string;
  currentUserId: string;
  factionId: string | null;
}

// --- Resource Metadata ---

const RESOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
  oil: { label: 'Oil', icon: 'OIL', color: '#CC9933' },
  minerals: { label: 'Minerals', icon: 'MIN', color: '#8494A7' },
  food: { label: 'Food', icon: 'FD', color: '#5CB85C' },
  tech: { label: 'Tech', icon: 'TCH', color: '#4A90D9' },
  manpower: { label: 'Manpower', icon: 'MAN', color: '#CC9933' },
  influence: { label: 'Influence', icon: 'INF', color: '#D4A843' },
};

type TradeTab = 'market' | 'orderbook' | 'orders' | 'history';

// --- Component ---

export default function TradeMarket({
  serverUrl,
  authToken,
  currentUserId,
  factionId,
}: TradeMarketProps) {
  const [tab, setTab] = useState<TradeTab>('market');
  const [markets, setMarkets] = useState<MarketSnapshot[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('oil');
  const [orderBook, setOrderBook] = useState<{ buys: TradeOrder[]; sells: TradeOrder[] }>({ buys: [], sells: [] });
  const [myOrders, setMyOrders] = useState<TradeOrder[]>([]);
  const [executions, setExecutions] = useState<TradeExecution[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Order form state
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderQty, setOrderQty] = useState('100');
  const [orderPrice, setOrderPrice] = useState('');
  const [placing, setPlacing] = useState(false);

  // Fetch market data
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/market`);
      if (res.ok) {
        const data = await res.json();
        setMarkets(data.markets || []);
      }
    } catch {
      /* ignore */
    }
  }, [serverUrl]);

  // Fetch order book for selected resource
  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/market/${selectedResource}/orderbook`);
      if (res.ok) {
        const data = await res.json();
        setOrderBook({ buys: data.buys || [], sells: data.sells || [] });
      }
    } catch {
      /* ignore */
    }
  }, [serverUrl, selectedResource]);

  // Fetch my orders
  const fetchMyOrders = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/orders/my`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data.orders || []);
      }
    } catch {
      /* ignore */
    }
  }, [serverUrl, authToken]);

  // Fetch recent executions
  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/executions`);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
      }
    } catch {
      /* ignore */
    }
  }, [serverUrl]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 10_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  useEffect(() => {
    if (tab === 'orderbook') fetchOrderBook();
    if (tab === 'orders') fetchMyOrders();
    if (tab === 'history') fetchExecutions();
  }, [tab, fetchOrderBook, fetchMyOrders, fetchExecutions]);

  // Set default price when resource changes
  useEffect(() => {
    const market = markets.find(m => m.resource === selectedResource);
    if (market && !orderPrice) {
      setOrderPrice(market.price.toFixed(2));
    }
  }, [selectedResource, markets, orderPrice]);

  // Place order
  const handlePlaceOrder = async () => {
    if (!factionId || !authToken) {
      setError('You must be in a faction to trade');
      return;
    }
    setPlacing(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          side: orderSide,
          resource: selectedResource,
          quantity: parseInt(orderQty) || 0,
          price_per_unit: parseFloat(orderPrice) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to place order');
      }

      setOrderQty('100');
      setOrderPrice('');
      fetchMyOrders();
      fetchOrderBook();
      fetchMarkets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  // Cancel order
  const handleCancel = async (orderId: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/economy/trade/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        fetchMyOrders();
        fetchOrderBook();
      }
    } catch {
      /* ignore */
    }
  };

  const TABS: { key: TradeTab; label: string }[] = [
    { key: 'market', label: 'MARKET' },
    { key: 'orderbook', label: 'ORDER BOOK' },
    { key: 'orders', label: 'MY ORDERS' },
    { key: 'history', label: 'HISTORY' },
  ];

  return (
    <div style={{
      background: SK.cardBg,
      border: sketchBorder(),
      borderRadius: radius.lg,
      boxShadow: sketchShadow('md'),
      overflow: 'hidden',
      fontFamily: bodyFont,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: sketchBorder(SK.borderDark),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h3 style={{
          fontFamily: headingFont,
          fontSize: SKFont.h3,
          color: SK.textWhite,
          margin: 0,
          letterSpacing: '1px',
        }}>
          GLOBAL EXCHANGE
        </h3>

        {/* Resource Selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {Object.entries(RESOURCE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => { setSelectedResource(key); setOrderPrice(''); }}
              style={{
                fontFamily: headingFont,
                fontSize: SKFont.xs,
                color: selectedResource === key ? SK.textWhite : SK.textMuted,
                background: selectedResource === key ? `${meta.color}30` : 'transparent',
                border: selectedResource === key ? `1px solid ${meta.color}50` : '1px solid transparent',
                borderRadius: radius.sm,
                padding: '3px 8px',
                cursor: 'pointer',
                letterSpacing: '1px',
              }}
            >
              {meta.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: sketchBorder(SK.borderDark),
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px',
              fontFamily: headingFont,
              fontSize: SKFont.xs,
              color: tab === t.key ? SK.gold : SK.textMuted,
              background: tab === t.key ? `${SK.gold}10` : 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? `2px solid ${SK.gold}` : '2px solid transparent',
              cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', minHeight: '300px' }}>
        {/* Market Overview */}
        {tab === 'market' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Resource', 'Price', 'Change', '24h Vol', 'High', 'Low', 'Orders'].map(h => (
                    <th key={h} style={{
                      fontFamily: bodyFont,
                      fontSize: SKFont.xs,
                      color: SK.textMuted,
                      fontWeight: 600,
                      padding: '6px 8px',
                      textAlign: 'left',
                      borderBottom: sketchBorder(SK.borderDark),
                      letterSpacing: '1px',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {markets.map(m => {
                  const meta = RESOURCE_META[m.resource] || { label: m.resource, icon: '?', color: SK.textMuted };
                  const isUp = m.price_delta >= 0;
                  return (
                    <tr
                      key={m.resource}
                      onClick={() => { setSelectedResource(m.resource); setTab('orderbook'); setOrderPrice(''); }}
                      style={{
                        cursor: 'pointer',
                        background: selectedResource === m.resource ? `${meta.color}08` : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontFamily: headingFont,
                          fontSize: SKFont.xs,
                          color: meta.color,
                          background: `${meta.color}15`,
                          padding: '2px 6px',
                          borderRadius: radius.sm,
                        }}>
                          {meta.icon}
                        </span>
                        <span style={{ color: SK.textPrimary, fontSize: SKFont.sm }}>{meta.label}</span>
                      </td>
                      <td style={{ padding: '8px', color: SK.textWhite, fontWeight: 600, fontSize: SKFont.sm }}>
                        {m.price.toFixed(2)} G
                      </td>
                      <td style={{ padding: '8px', color: isUp ? SK.green : SK.red, fontSize: SKFont.sm }}>
                        {isUp ? '+' : ''}{m.price_delta.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', color: SK.textSecondary, fontSize: SKFont.sm }}>
                        {m.volume_24h.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', color: SK.textSecondary, fontSize: SKFont.xs }}>
                        {m.high_price_24h.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', color: SK.textSecondary, fontSize: SKFont.xs }}>
                        {m.low_price_24h.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px', color: SK.textMuted, fontSize: SKFont.xs }}>
                        B:{m.buy_orders} / S:{m.sell_orders}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Order Book */}
        {tab === 'orderbook' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Bids (Buy) */}
            <div>
              <h4 style={{
                fontFamily: headingFont,
                fontSize: SKFont.xs,
                color: SK.green,
                margin: '0 0 8px 0',
                letterSpacing: '2px',
              }}>
                BIDS (BUY)
              </h4>
              {orderBook.buys.length === 0 ? (
                <div style={{ color: SK.textMuted, fontSize: SKFont.xs }}>No buy orders</div>
              ) : (
                orderBook.buys.map(o => (
                  <div key={o.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: `${SK.green}08`,
                    borderRadius: radius.sm,
                    marginBottom: '2px',
                    fontSize: SKFont.xs,
                  }}>
                    <span style={{ color: SK.green }}>{o.price_per_unit.toFixed(2)} G</span>
                    <span style={{ color: SK.textSecondary }}>{(o.quantity - o.filled).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            {/* Asks (Sell) */}
            <div>
              <h4 style={{
                fontFamily: headingFont,
                fontSize: SKFont.xs,
                color: SK.red,
                margin: '0 0 8px 0',
                letterSpacing: '2px',
              }}>
                ASKS (SELL)
              </h4>
              {orderBook.sells.length === 0 ? (
                <div style={{ color: SK.textMuted, fontSize: SKFont.xs }}>No sell orders</div>
              ) : (
                orderBook.sells.map(o => (
                  <div key={o.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: `${SK.red}08`,
                    borderRadius: radius.sm,
                    marginBottom: '2px',
                    fontSize: SKFont.xs,
                  }}>
                    <span style={{ color: SK.red }}>{o.price_per_unit.toFixed(2)} G</span>
                    <span style={{ color: SK.textSecondary }}>{(o.quantity - o.filled).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* My Orders */}
        {tab === 'orders' && (
          <div>
            {myOrders.length === 0 ? (
              <div style={{ color: SK.textMuted, fontSize: SKFont.sm, textAlign: 'center', padding: '20px' }}>
                No orders placed yet
              </div>
            ) : (
              myOrders.map(o => {
                const meta = RESOURCE_META[o.resource];
                const isOpen = o.status === 'open' || o.status === 'partial';
                return (
                  <div key={o.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: SK.bg,
                    borderRadius: radius.sm,
                    border: sketchBorder(SK.borderDark),
                    marginBottom: '4px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: SKFont.xs,
                        fontFamily: headingFont,
                        color: o.side === 'buy' ? SK.green : SK.red,
                        letterSpacing: '1px',
                      }}>
                        {o.side.toUpperCase()}
                      </span>
                      <span style={{ fontSize: SKFont.xs, color: meta?.color || SK.textMuted }}>
                        {meta?.icon || o.resource}
                      </span>
                      <span style={{ fontSize: SKFont.xs, color: SK.textPrimary }}>
                        {o.filled}/{o.quantity} @ {o.price_per_unit.toFixed(2)}G
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: SKFont.xs,
                        color: isOpen ? SK.green : SK.textMuted,
                      }}>
                        {o.status.toUpperCase()}
                      </span>
                      {isOpen && (
                        <button
                          onClick={() => handleCancel(o.id)}
                          style={{
                            fontSize: SKFont.xs,
                            color: SK.red,
                            background: 'transparent',
                            border: `1px solid ${SK.red}40`,
                            borderRadius: radius.sm,
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Trade History */}
        {tab === 'history' && (
          <div>
            {executions.length === 0 ? (
              <div style={{ color: SK.textMuted, fontSize: SKFont.sm, textAlign: 'center', padding: '20px' }}>
                No recent trades
              </div>
            ) : (
              executions.slice(0, 20).map(e => {
                const meta = RESOURCE_META[e.resource];
                return (
                  <div key={e.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderBottom: sketchBorder(SK.borderDark),
                    fontSize: SKFont.xs,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: meta?.color || SK.textMuted }}>
                        {meta?.icon || e.resource}
                      </span>
                      <span style={{ color: SK.textPrimary }}>
                        {e.quantity.toLocaleString()} @ {e.price_per_unit.toFixed(2)}G
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: SK.gold }}>
                        {e.total_gold.toLocaleString()}G
                      </span>
                      {e.route_fee > 0 && (
                        <span style={{ color: SK.textMuted }}>
                          fee:{e.route_fee}G
                        </span>
                      )}
                      <span style={{ color: SK.textMuted }}>
                        {new Date(e.executed_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Order Entry Form (bottom) */}
      {factionId && (
        <div style={{
          padding: '12px 20px',
          borderTop: sketchBorder(SK.borderDark),
          background: `${SK.bg}80`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            {/* Side toggle */}
            <div style={{ display: 'flex', borderRadius: radius.sm, overflow: 'hidden' }}>
              <button
                onClick={() => setOrderSide('buy')}
                style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.xs,
                  color: orderSide === 'buy' ? SK.textWhite : SK.textMuted,
                  background: orderSide === 'buy' ? SK.green : 'transparent',
                  border: `1px solid ${orderSide === 'buy' ? SK.green : SK.border}`,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderSide('sell')}
                style={{
                  fontFamily: headingFont,
                  fontSize: SKFont.xs,
                  color: orderSide === 'sell' ? SK.textWhite : SK.textMuted,
                  background: orderSide === 'sell' ? SK.red : 'transparent',
                  border: `1px solid ${orderSide === 'sell' ? SK.red : SK.border}`,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}
              >
                SELL
              </button>
            </div>

            {/* Resource label */}
            <span style={{
              fontFamily: headingFont,
              fontSize: SKFont.xs,
              color: RESOURCE_META[selectedResource]?.color || SK.textMuted,
              letterSpacing: '1px',
            }}>
              {RESOURCE_META[selectedResource]?.icon || selectedResource}
            </span>

            {/* Quantity */}
            <input
              type="number"
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
              placeholder="Qty"
              style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                color: SK.textPrimary,
                background: SK.bg,
                border: sketchBorder(),
                borderRadius: radius.sm,
                padding: '4px 8px',
                width: '80px',
              }}
            />

            <span style={{ color: SK.textMuted, fontSize: SKFont.xs }}>@</span>

            {/* Price */}
            <input
              type="number"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              placeholder="Price"
              step="0.01"
              style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                color: SK.textPrimary,
                background: SK.bg,
                border: sketchBorder(),
                borderRadius: radius.sm,
                padding: '4px 8px',
                width: '80px',
              }}
            />

            <span style={{ color: SK.textMuted, fontSize: SKFont.xs }}>G/unit</span>

            {/* Total preview */}
            <span style={{
              color: SK.gold,
              fontSize: SKFont.xs,
              fontWeight: 600,
              marginLeft: 'auto',
            }}>
              Total: {((parseInt(orderQty) || 0) * (parseFloat(orderPrice) || 0)).toLocaleString()} G
            </span>

            {/* Submit */}
            <button
              onClick={handlePlaceOrder}
              disabled={placing || !orderQty || !orderPrice}
              style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                fontWeight: 600,
                color: SK.textWhite,
                background: orderSide === 'buy' ? SK.green : SK.red,
                border: 'none',
                borderRadius: radius.md,
                padding: '6px 16px',
                cursor: placing ? 'not-allowed' : 'pointer',
                opacity: placing ? 0.6 : 1,
              }}
            >
              {placing ? '...' : orderSide === 'buy' ? 'Place Buy' : 'Place Sell'}
            </button>
          </div>

          {error && (
            <div style={{ color: SK.red, fontSize: SKFont.xs, marginTop: '6px' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
