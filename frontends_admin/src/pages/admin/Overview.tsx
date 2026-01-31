import { motion } from 'framer-motion';
import { Users, CreditCard, Download, Activity, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getOverview } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20, rotateX: -10 },
  visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 100 } }
};

function Overview() {
  const overviewQuery = useQuery({ queryKey: ['admin-overview'], queryFn: getOverview });

  const data = overviewQuery.data;

  if (overviewQuery.isLoading) {
    return <div className="text-mutedForeground animate-pulse">Chargement en cours...</div>;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="perspective-1000"
    >
      <PageHeader
        title="Vue d'ensemble"
        description="Indicateurs de performance et dynamique de croissance en temps réel."
      />

      {overviewQuery.isError ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Impossible de charger les statistiques.
        </motion.div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <motion.div variants={itemVariants}>
          <Card className="hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
              <CardTitle className="text-sm font-medium text-mutedForeground uppercase tracking-wider">Total utilisateurs</CardTitle>
              <Users className="h-5 w-5 text-primary opacity-70" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tight">{data?.totals.total_users ?? 0}</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary font-medium">
                  Free: {data?.totals.total_users_free ?? 0}
                </span>
                <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-500 font-medium">
                  Pro: {data?.totals.total_users_premium ?? 0}
                </span>
                <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-500 font-medium">
                  VIP: {data?.totals.total_users_vip ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover:border-blue-500/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
              <CardTitle className="text-sm font-medium text-mutedForeground uppercase tracking-wider">Abonnements actifs</CardTitle>
              <CreditCard className="h-5 w-5 text-blue-500 opacity-70" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tight">{data?.totals.total_active_subscriptions ?? 0}</p>
              <p className="mt-4 flex items-center gap-1 text-xs text-mutedForeground">
                <Activity className="h-3 w-3 text-green-500" />
                Suivi des abonnements en cours.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="hover:border-purple-500/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-none">
              <CardTitle className="text-sm font-medium text-mutedForeground uppercase tracking-wider">Exports RGPD (24h)</CardTitle>
              <Download className="h-5 w-5 text-purple-500 opacity-70" />
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tight">{data?.totals.total_exports_24h ?? 0}</p>
              <p className="mt-4 flex items-center gap-1 text-xs text-mutedForeground">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Demandes traitées sur 24h.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Inscriptions (7 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.timeseries.signups_per_day ?? []}>
                  <defs>
                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.1)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Upgrades & Churn
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={(data?.timeseries.upgrades_per_day ?? []).map((item, idx) => ({
                    date: item.date,
                    upgrades: item.value,
                    churn: data?.timeseries.churn_per_day[idx]?.value ?? 0
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.1)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="upgrades"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="churn"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Overview;
