import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { isOnline, onOnline, onOffline } from "./lib/offline";
import {
  format,
  addYears,
  isAfter,
  parseISO,
} from "date-fns";
import { arSA } from "date-fns/locale";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Trash2,
  Search,
  FileText,
  Settings,
  Plus,
  Save,
  X,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, setApiServer, getApiServer, API_BASE } from "./lib/api";

const isNative = window.location.protocol === "capacitor:" || window.location.protocol === "file:";

interface Employee {
  id: number;
  name: string;
  hireDate: string;
}

interface RenewalInfo {
  id: number;
  name: string;
  hireDate: string;
  hireDateFormatted: string;
  renewalDate: string;
  renewalDateFormatted: string;
  daysUntil: number;
  status: string;
}

interface SheetRow {
  _key: string;
  id: number | null;
  name: string;
  hireDate: string;
  _dirty: boolean;
}

let rowKeyCounter = 0;
function makeKey(): string {
  return `row_${++rowKeyCounter}_${Date.now()}`;
}

function toSheetRows(employees: Employee[]): SheetRow[] {
  return employees.map((emp) => ({
    _key: makeKey(),
    id: emp.id,
    name: emp.name,
    hireDate: emp.hireDate,
    _dirty: false,
  }));
}

function getNextRenewalDate(hireDate: string) {
  const parsed = parseISO(hireDate);
  let renewal = addYears(parsed, 1);
  const now = new Date();
  while (!isAfter(renewal, now)) {
    renewal = addYears(renewal, 1);
  }
  return renewal;
}

function getDaysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderDays, setReminderDays] = useState("30");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiServer());
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEmployees();
    fetchSettings();
    if (isNative) {
      testConnection();
    }
    const off1 = onOnline(() => setIsOffline(false));
    const off2 = onOffline(() => setIsOffline(true));
    return () => { off1(); off2(); };
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const res = await fetch(`${api("/health")}`, { signal: AbortSignal.timeout(5000) });
      setServerConnected(res.ok);
    } catch {
      setServerConnected(false);
    }
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${api("/employees")}`);
      if (!res.ok) throw new Error("فشل في جلب البيانات");
      const data: Employee[] = await res.json();
      setEmployees(data);
      setSheetRows(toSheetRows(data));
      setHasChanges(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${api("/settings")}`);
      if (res.ok) {
        const data = await res.json();
        setReminderEmail(data.reminder_email || "");
        setReminderDays(data.reminder_days || "30");
      }
    } catch {
      // silent
    }
  };

  const saveSettings = async () => {
    setError("");
    try {
      await fetch(`${api("/settings")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "reminder_email", value: reminderEmail }),
      });
      await fetch(`${api("/settings")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "reminder_days", value: reminderDays }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في حفظ الإعدادات");
    }
  };

  // --- Sheet operations ---
  const addRow = () => {
    setSheetRows([
      ...sheetRows,
      { _key: makeKey(), id: null, name: "", hireDate: "", _dirty: true },
    ]);
    setHasChanges(true);
  };

  const updateRow = (key: string, field: "name" | "hireDate", value: string) => {
    setSheetRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value, _dirty: true } : r))
    );
    setHasChanges(true);
  };

  const removeRow = (key: string) => {
    const row = sheetRows.find((r) => r._key === key);
    if (row && row.id !== null) {
      setEmployeeToDelete({ id: row.id, name: row.name, hireDate: row.hireDate });
    }
    setSheetRows((prev) => prev.filter((r) => r._key !== key));
    setHasChanges(true);
  };

  const saveSheet = async () => {
    setSaving(true);
    setError("");
    try {
      const employeesData = sheetRows
        .filter((r) => r.name.trim() && r.hireDate)
        .map((r) => ({ name: r.name.trim(), hireDate: r.hireDate }));

      const res = await fetch(`${api("/employees/bulk")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: employeesData }),
      });
      if (!res.ok) throw new Error("فشل في الحفظ");
      setSuccess("تم الحفظ بنجاح!");
      setTimeout(() => setSuccess(""), 2000);
      fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setError("");
    try {
      const res = await fetch(`${api("/employees/")}${employeeToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("فشل في الحذف");
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    }
  };

  // --- Import from Excel ---
  const importFromExcel = (e: ChangeEvent<HTMLInputElement>, replace: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

        const nameKey = Object.keys(data[0] || {}).find(
          (k) => k.toLowerCase().includes("name") || k.includes("اسم")
        );
        const dateKey = Object.keys(data[0] || {}).find(
          (k) =>
            k.toLowerCase().includes("hire") ||
            k.toLowerCase().includes("date") ||
            k.includes("تاريخ")
        );

        if (!nameKey || !dateKey) {
          throw new Error("الملف يجب أن يحتوي على أعمدة اسم وتاريخ التعيين");
        }

        const importedRows: SheetRow[] = data
          .filter((r) => r[nameKey] && r[dateKey])
          .map((r) => ({
            _key: makeKey(),
            id: null,
            name: String(r[nameKey]),
            hireDate: String(r[dateKey]),
            _dirty: true,
          }));

        if (replace) {
          setSheetRows(importedRows);
        } else {
          setSheetRows((prev) => [...prev, ...importedRows]);
        }
        setHasChanges(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "خطأ في قراءة الملف");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // --- Export ---
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sheetRows
        .filter((r) => r.name)
        .map((r) => ({ Name: r.name, HireDate: r.hireDate }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "Employees.xlsx");
  };

  const exportToPDF = async () => {
    try {
      const res = await fetch(`${api("/renewals")}`);
      if (!res.ok) throw new Error("فشل في جلب بيانات التجديدات");
      const renewals: RenewalInfo[] = await res.json();
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(18);
      doc.text("Contract Renewal Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Total: ${renewals.length}`, 14, 34);
      autoTable(doc, {
        startY: 40,
        head: [["#", "Name", "Hire Date", "Renewal Date", "Days", "Status"]],
        body: renewals.map((r, i) => [
          String(i + 1), r.name, r.hireDateFormatted, r.renewalDateFormatted, String(r.daysUntil), r.status,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      doc.save("renewal-report.pdf");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تصدير PDF");
    }
  };

  const sendMonthlyReport = async () => {
    setSendingReport(true);
    setError("");
    try {
      const res = await fetch(`${api("/send-monthly-report")}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في الإرسال");
      setSuccess(data.message);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSendingReport(false);
    }
  };

  // --- Filtering ---
  const filteredRows = sheetRows.filter(
    (r) => r.name.includes(search) || search === ""
  );

  const validCount = sheetRows.filter((r) => r.name.trim() && r.hireDate).length;

  // --- Chart data ---
  const now = new Date();
  const chartData = employees.reduce(
    (acc, emp) => {
      const next = getNextRenewalDate(emp.hireDate);
      if (isAfter(next, now) && getDaysUntil(next) <= 365) {
        const month = format(next, "MMMM", { locale: arSA });
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );
  const dataForChart = Object.entries(chartData).map(([month, count]) => ({
    month,
    count,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans text-gray-900" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">تتبع تجديد عقود الموظفين</h1>
        <div className="flex gap-3">
          <button
            onClick={sendMonthlyReport}
            disabled={sendingReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Send size={16} />
            {sendingReport ? "جاري الإرسال..." : "إرسال التقرير الشهري"}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            <Settings size={18} />
            الإعدادات
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg flex items-center gap-2">
          <WifiOff size={16} />
          أنت غير متصل بالإنترنت - البيانات قد لا تكون محدثة
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">{success}</div>}

      {/* Settings */}
      {showSettings && (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">الإعدادات</h2>
          <div className="grid gap-4">
            {isNative && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {serverConnected === null ? (
                    <Wifi size={16} className="text-gray-400" />
                  ) : serverConnected ? (
                    <Wifi size={16} className="text-green-600" />
                  ) : (
                    <WifiOff size={16} className="text-red-600" />
                  )}
                  <span className="font-medium">
                    {serverConnected === null
                      ? "جاري الفحص..."
                      : serverConnected
                        ? "متصل بالسيرفر"
                        : "غير متصل بالسيرفر"}
                  </span>
                </div>
                <label className="block text-sm font-medium mb-1">رابط السيرفر</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://192.168.1.100:3000"
                    className="p-2 border rounded flex-grow"
                  />
                  <button
                    onClick={() => {
                      setApiServer(serverUrl);
                      testConnection();
                      fetchEmployees();
                      fetchSettings();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    اتصال
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  اكتب رابط السيرفر الذي يعمل عليه التطبيق (مثال: http://192.168.1.5:3000)
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">إيميل التذكير (يومياً + تقرير شهري)</label>
              <input
                type="email"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                placeholder="admin@company.com"
                className="p-2 border rounded w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">عدد أيام التذكير قبل التجديد (للتنبيه اليومي)</label>
              <input
                type="number"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                min="1" max="365"
                className="p-2 border rounded w-32"
              />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={saveSettings} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                حفظ الإعدادات
              </button>
              {settingsSaved && <span className="text-green-600 text-sm">تم الحفظ!</span>}
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet Section */}
      <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">جدول الموظفين</h2>
            <span className="text-sm text-gray-500">
              {validCount} موظف
              {hasChanges && <span className="text-orange-500 mr-2">(تغييرات غير محفوظة)</span>}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="p-2 border rounded pr-8 w-48"
              />
              <Search className="absolute right-2 top-2.5 text-gray-400" size={14} />
            </div>
            <button onClick={addRow} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Plus size={14} /> صف جديد
            </button>
            <button
              onClick={saveSheet}
              disabled={!hasChanges || saving}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
            >
              <Save size={14} /> {saving ? "جاري الحفظ..." : "حفظ الكل"}
            </button>
          </div>
        </div>

        {/* Spreadsheet Table */}
        <div className="overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 border text-center w-10">#</th>
                <th className="p-2 border text-right w-16">الحالة</th>
                <th className="p-2 border text-right">اسم الموظف</th>
                <th className="p-2 border text-right w-40">تاريخ التعيين</th>
                <th className="p-2 border text-right w-40">تاريخ التجديد</th>
                <th className="p-2 border text-center w-20">الأيام</th>
                <th className="p-2 border text-center w-16">حذف</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">جاري التحميل...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    {hasChanges ? "أضف صفوف جديدة واحفظها" : "لا يوجد موظفين. اضغط 'صف جديد' للبدء"}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const nextDate = row.hireDate ? getNextRenewalDate(row.hireDate) : null;
                  const days = nextDate ? getDaysUntil(nextDate) : null;
                  const daysColor = days === null ? "" : days <= 30 ? "text-red-600 font-bold" : days <= 90 ? "text-yellow-600" : "text-gray-500";
                  const statusColor = days === null ? "bg-gray-100" : days <= 30 ? "bg-red-100" : days <= 90 ? "bg-yellow-100" : "bg-green-100";
                  return (
                    <tr key={row._key} className={row._dirty && row.id === null ? "bg-blue-50" : ""}>
                      <td className="p-1 border text-center text-gray-400">{idx + 1}</td>
                      <td className={`p-1 border text-center text-xs font-bold ${statusColor}`}>
                        {days !== null ? (days <= 30 ? "عاجل" : days <= 90 ? "قريب" : "جيد") : "—"}
                      </td>
                      <td className="p-1 border">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateRow(row._key, "name", e.target.value)}
                          className="w-full p-1.5 border-0 bg-transparent focus:bg-blue-50 focus:outline-none rounded"
                          placeholder="اسم الموظف"
                        />
                      </td>
                      <td className="p-1 border">
                        <input
                          type="date"
                          value={row.hireDate}
                          onChange={(e) => updateRow(row._key, "hireDate", e.target.value)}
                          className="w-full p-1.5 border-0 bg-transparent focus:bg-blue-50 focus:outline-none rounded"
                        />
                      </td>
                      <td className="p-1.5 border text-gray-600 text-center">
                        {nextDate ? format(nextDate, "yyyy-MM-dd") : "—"}
                      </td>
                      <td className={`p-1.5 border text-center ${daysColor}`}>
                        {days !== null ? `${days} يوم` : "—"}
                      </td>
                      <td className="p-1 border text-center">
                        <button onClick={() => removeRow(row._key)} className="text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom actions */}
        <div className="p-3 border-t flex gap-3 flex-wrap">
          <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            <Plus size={14} /> صف جديد
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
            تصدير Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">
            <FileText size={14} /> تصدير PDF
          </button>
          <span className="border-r mx-1" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">
            استيراد من Excel (إضافة)
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => importFromExcel(e, false)} className="hidden" accept=".xlsx,.xls,.csv" />
          <button onClick={() => replaceFileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white text-sm rounded hover:bg-orange-700">
            استيراد من Excel (استبدال)
          </button>
          <input type="file" ref={replaceFileInputRef} onChange={(e) => importFromExcel(e, true)} className="hidden" accept=".xlsx,.xls,.csv" />
        </div>
      </div>

      {/* Chart */}
      {dataForChart.length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-6">التجديدات حسب الشهر</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataForChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تأكيد الحذف</h3>
            <p className="mb-6">هل أنت متأكد من حذف {employeeToDelete.name}؟</p>
            <div className="flex gap-4 justify-end">
              <button onClick={() => setEmployeeToDelete(null)} className="px-4 py-2 border rounded">إلغاء</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
