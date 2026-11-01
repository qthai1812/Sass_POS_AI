import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Store, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  getDashboardSummary,
  getStoreRegistrationStats,
  getStoreStatusDistribution,
} from "../../Redux Toolkit/features/adminDashboard/adminDashboardThunks";
import { getAllStores } from "../../Redux Toolkit/features/store/storeThunks";
import { formatDateTime } from "../../utils/formateDate";

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const StatCard = ({ title, value, icon, description, trend }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {trend !== undefined && (
          <span
            className={
              trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : ""
            }
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {description}
      </p>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const dispatch = useDispatch();
  const {
    dashboardSummary,
    storeRegistrationStats,
    storeStatusDistribution,
    loading,
    error,
  } = useSelector((state) => state.adminDashboard);
  const { stores = [] } = useSelector((state) => state.store);

  useEffect(() => {
    dispatch(getDashboardSummary());
    dispatch(getStoreRegistrationStats());
    dispatch(getStoreStatusDistribution());
    dispatch(getAllStores());
  }, [dispatch]);

  const barData =
    storeRegistrationStats?.map((item) => ({
      date: item.date || item.day || item.label,
      stores: item.count || item.value || 0,
    })) || [];

  const pieData = storeStatusDistribution
    ? [
        {
          name: "Active",
          value: Number(storeStatusDistribution.active || 0),
          color: COLORS[0],
        },
        {
          name: "Pending",
          value: Number(storeStatusDistribution.pending || 0),
          color: COLORS[1],
        },
        {
          name: "Blocked",
          value: Number(storeStatusDistribution.blocked || 0),
          color: COLORS[2],
        },
      ]
    : [];

  const totalStoresInPie = pieData.reduce(
    (acc, curr) => acc + (curr.value || 0),
    0
  );

  // Lấy 5 cửa hàng có hoạt động mới nhất từ dữ liệu thực
  const recentStores = [...stores]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
        new Date(a.updatedAt || a.createdAt || 0),
    )
    .slice(0, 5);

  const getActivityInfo = (store) => {
    const status = store.status?.toUpperCase();
    if (status === "ACTIVE") {
      return {
        dotColor: "bg-green-500",
        text: `Store "${store.brand}" is active (Owner: ${store.storeAdmin?.fullName || "N/A"})`,
      };
    }
    if (status === "BLOCKED") {
      return {
        dotColor: "bg-red-500",
        text: `Store "${store.brand}" has been blocked`,
      };
    }
    return {
      dotColor: "bg-yellow-500",
      text: `New store "${store.brand}" registered and awaiting approval`,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of all stores and system statistics
        </p>
      </div>

      {loading && <div className="text-center py-8">Loading dashboard...</div>}
      {error && <div className="text-center py-8 text-red-500">{error}</div>}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Stores"
          value={dashboardSummary?.totalStores ?? "-"}
          icon={<Store className="h-4 w-4 text-muted-foreground" />}
          description="registered in system"
        />
        <StatCard
          title="Active Stores"
          value={dashboardSummary?.activeStores ?? "-"}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="currently operational"
        />
        <StatCard
          title="Blocked Stores"
          value={dashboardSummary?.blockedStores ?? "-"}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          description="suspended accounts"
        />
        <StatCard
          title="Pending Requests"
          value={dashboardSummary?.pendingStores ?? "-"}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          description="awaiting approval"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Store Registrations (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barData}>
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <Tooltip />
                <Bar
                  dataKey="stores"
                  fill="currentColor"
                  radius={[4, 4, 0, 0]}
                  className="fill-primary"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Store Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {totalStoresInPie === 0 ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground text-sm">
                <Store className="h-10 w-10 mb-2 opacity-30" />
                <p>No store data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ name, percent, value }) => {
                      if (!value || value <= 0 || !percent || percent <= 0) return null;
                      return `${name} ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} store${value !== 1 ? "s" : ""}`,
                      name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry) => (
                      <span className="text-xs font-medium text-muted-foreground mr-2">
                        {value}:{" "}
                        <span className="font-semibold text-foreground">
                          {entry.payload?.value ?? 0}
                        </span>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity (Real Data) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Store Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentStores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No store activity recorded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {recentStores.map((store) => {
                const info = getActivityInfo(store);
                return (
                  <div
                    key={store.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <div
                      className={`w-2.5 h-2.5 ${info.dotColor} rounded-full shrink-0`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{info.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(store.updatedAt || store.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
