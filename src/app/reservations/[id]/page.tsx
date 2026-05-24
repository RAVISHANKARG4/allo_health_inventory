'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Clock, ShieldCheck, XCircle, ArrowLeft, CreditCard, Sparkles, AlertCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
});

interface ReservationDetail {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED';
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const { data: reservation, error, mutate, isLoading } = useSWR<ReservationDetail>(
    reservationId ? `/api/reservations/${reservationId}` : null,
    fetcher,
    {
      refreshInterval: 5000, // Revalidate background status every 5 seconds
    }
  );

  // Time calculations
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [isExpired, setIsExpired] = React.useState(false);

  // Actions states
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isReleasing, setIsReleasing] = React.useState(false);

  // Idempotency Testing
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>('');
  const [useCustomKey, setUseCustomKey] = React.useState(false);

  React.useEffect(() => {
    if (!useCustomKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [useCustomKey, reservationId]);

  // Handle countdown timer ticking
  React.useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      const difference = expiresTime - Date.now();
      const secondsRemaining = Math.max(0, Math.floor(difference / 1000));
      
      setTimeLeft(secondsRemaining);

      if (secondsRemaining <= 0) {
        setIsExpired(true);
        mutate(); // trigger API refresh to verify state
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [reservation, mutate]);

  const handleConfirm = async () => {
    if (!reservation) return;
    setIsConfirming(true);

    const confirmKey = idempotencyKey.trim();

    try {
      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(confirmKey ? { 'Idempotency-Key': confirmKey } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          toast({
            title: 'Purchase Failed',
            description: 'This reservation has expired.',
            variant: 'destructive',
          });
          setIsExpired(true);
        } else {
          toast({
            title: `Confirmation Failed (${response.status})`,
            description: data.error?.message || 'Failed to confirm purchase.',
            variant: 'destructive',
          });
        }
        mutate();
        return;
      }

      toast({
        title: 'Payment Successful!',
        description: 'Your inventory has been permanently allocated.',
        variant: 'success',
      });
      
      mutate();
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to process confirm request.',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRelease = async () => {
    if (!reservation) return;
    setIsReleasing(true);

    try {
      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Cancellation Failed',
          description: data.error?.message || 'Could not cancel reservation.',
          variant: 'destructive',
        });
        mutate();
        return;
      }

      toast({
        title: 'Reservation Cancelled',
        description: 'Stock has been returned to the warehouse catalog.',
        variant: 'default',
      });

      mutate();
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to cancel reservation.',
        variant: 'destructive',
      });
    } finally {
      setIsReleasing(false);
    }
  };

  // Helper formatting for countdown minutes:seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading && !reservation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="h-10 w-10 animate-spin border-4 border-indigo-500 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-400">Loading reservation status...</p>
      </div>
    );
  }

  // Error state
  if (error || !reservation) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-100">Reservation Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested reservation ID does not exist or has been cleaned up.
        </p>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Catalog
        </Button>
      </div>
    );
  }

  // Determine current active status
  const currentStatus = reservation.status;
  const isPending = currentStatus === 'PENDING' && !isExpired;
  const isFinalExpired = isExpired || (currentStatus === 'PENDING' && new Date(reservation.expiresAt) < new Date());
  
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Button onClick={() => router.push('/')} variant="ghost" className="text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Catalog
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Details Panel */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader className="border-b border-slate-900/60">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                    Reservation ID
                  </span>
                  <CardTitle className="text-sm font-mono text-indigo-300 break-all select-all">
                    {reservation.id}
                  </CardTitle>
                </div>
                <div className="shrink-0">
                  {currentStatus === 'CONFIRMED' && (
                    <Badge variant="success" className="text-xs px-2.5 py-1">
                      CONFIRMED
                    </Badge>
                  )}
                  {currentStatus === 'RELEASED' && (
                    <Badge variant="secondary" className="text-xs px-2.5 py-1">
                      CANCELLED
                    </Badge>
                  )}
                  {currentStatus === 'PENDING' && isFinalExpired && (
                    <Badge variant="destructive" className="text-xs px-2.5 py-1">
                      EXPIRED
                    </Badge>
                  )}
                  {currentStatus === 'PENDING' && !isFinalExpired && (
                    <Badge variant="warning" className="text-xs px-2.5 py-1 animate-pulse">
                      PENDING
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase">Product</span>
                  <p className="font-semibold text-slate-200">{reservation.product?.name}</p>
                  <p className="text-xs font-mono text-slate-500">SKU: {reservation.product?.sku}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase">Warehouse</span>
                  <p className="font-semibold text-slate-200">{reservation.warehouse?.name}</p>
                  <p className="text-xs text-slate-500">{reservation.warehouse?.location}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase">Allocated Stock</span>
                  <p className="text-lg font-mono font-bold text-slate-100">{reservation.quantity} unit(s)</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase">Reservation Time</span>
                  <p className="font-mono text-slate-300">
                    {new Date(reservation.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Status information banners */}
              {currentStatus === 'CONFIRMED' && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-300 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Stock permanently consumed</h4>
                    <p className="text-xs text-emerald-300/80">
                      Payment processed successfully at {new Date(reservation.confirmedAt!).toLocaleTimeString()}.
                    </p>
                  </div>
                </div>
              )}

              {currentStatus === 'RELEASED' && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400 flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-slate-500 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Stock returned to warehouse</h4>
                    <p className="text-xs text-slate-500/80">
                      This temporary allocation was cancelled/released.
                    </p>
                  </div>
                </div>
              )}

              {currentStatus === 'PENDING' && isFinalExpired && (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 text-rose-300 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Checkout Session Expired</h4>
                    <p className="text-xs text-rose-300/80">
                      The 10-minute payment holding window has expired. The stock is released back into catalog.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action / Countdown Sidebar */}
        <div className="space-y-6">
          {/* Countdown Card */}
          {isPending && timeLeft !== null && (
            <Card className="border-slate-800 bg-linear-to-b from-indigo-950/20 to-slate-950/20 text-center">
              <CardContent className="p-6 space-y-4">
                <Clock className="h-8 w-8 text-amber-400 mx-auto animate-bounce" />
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Time Remaining to Checkout
                  </h4>
                  <p className="text-4xl font-mono font-bold text-slate-100 mt-1">
                    {formatTime(timeLeft)}
                  </p>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / 600) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checkout Controls */}
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-base font-bold">Transaction Controls</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <Button
                onClick={handleConfirm}
                disabled={!isPending}
                loading={isConfirming}
                className="w-full justify-center font-bold"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Confirm Purchase
              </Button>
              <Button
                onClick={handleRelease}
                disabled={!isPending}
                loading={isReleasing}
                variant="outline"
                className="w-full justify-center border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                Cancel Reservation
              </Button>
            </CardContent>
          </Card>

          {/* Idempotency key debugger on Confirm */}
          {isPending && (
            <Card className="border-slate-800 bg-slate-950/40 text-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Idempotency (Confirm)
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      id="customKeyConfirmCheck"
                      checked={useCustomKey}
                      onChange={(e) => setUseCustomKey(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="customKeyConfirmCheck" className="text-[10px] text-slate-500 cursor-pointer">
                      Lock
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => useCustomKey && setIdempotencyKey(e.target.value)}
                  disabled={!useCustomKey}
                  className="w-full h-8 px-2 rounded-md border border-slate-900 bg-slate-950 text-[10px] font-mono text-indigo-300 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Locking and repeating the checkout click with this key will demonstrate that the confirm API returns the original response without executing duplicate stock deductions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
