interface Env {
  BACKEND_URL?: string;
}

const FALLBACK_DATA = {
  employees: [
    { id: 1, name: "أحمد محمد", hireDate: "2023-01-15" },
    { id: 2, name: "سارة خالد", hireDate: "2023-03-20" },
    { id: 3, name: "محمد علي", hireDate: "2022-11-01" },
  ],
  settings: { reminder_days: "30", reminder_email: "" },
};

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function getNextRenewal(hireDate: string) {
  const d = new Date(hireDate);
  let r = new Date(d);
  r.setFullYear(r.getFullYear() + 1);
  const now = new Date();
  while (r <= now) r.setFullYear(r.getFullYear() + 1);
  return r;
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = (params.path as string[])?.join("/") || "";

  // Proxy to backend if configured
  if (env.BACKEND_URL) {
    const backendUrl = `${env.BACKEND_URL.replace(/\/+$/, "")}/${path}`;
    try {
      const resp = await fetch(backendUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method !== "GET" && method !== "HEAD" ? await request.text() : undefined,
      });
      return new Response(await resp.text(), {
        status: resp.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch {
      // fallback below
    }
  }

  // Health
  if (path === "health") {
    return Response.json({ status: "healthy", source: "cf-pages-fn" });
  }

  // GET /api/employees
  if (path === "employees" && method === "GET") {
    return Response.json(FALLBACK_DATA.employees);
  }

  // GET /api/employees/:id
  if (path.startsWith("employees/") && method === "GET") {
    const id = parseInt(path.split("/")[1], 10);
    const emp = FALLBACK_DATA.employees.find((e) => e.id === id);
    return emp ? Response.json(emp) : new Response("Not found", { status: 404 });
  }

  // POST /api/employees/bulk
  if (path === "employees/bulk" && method === "POST") {
    return Response.json({ success: true, count: 0 });
  }

  // POST /api/employees
  if (path === "employees" && method === "POST") {
    return Response.json({ id: Date.now(), ...await request.json() }, { status: 201 });
  }

  // PUT /api/employees/:id
  if (path.startsWith("employees/") && method === "PUT") {
    return Response.json({ success: true });
  }

  // DELETE /api/employees/:id
  if (path.startsWith("employees/") && method === "DELETE") {
    return Response.json({ success: true });
  }

  // GET /api/settings
  if (path === "settings" && method === "GET") {
    return Response.json(FALLBACK_DATA.settings);
  }

  // PUT /api/settings
  if (path === "settings" && method === "PUT") {
    return Response.json({ success: true });
  }

  // GET /api/renewals
  if (path === "renewals" && method === "GET") {
    const renewals = FALLBACK_DATA.employees.map((emp) => {
      const renewalDate = getNextRenewal(emp.hireDate);
      const days = daysUntil(renewalDate);
      return {
        ...emp,
        hireDateFormatted: new Date(emp.hireDate).toLocaleDateString("ar-SA"),
        renewalDate: renewalDate.toISOString().split("T")[0],
        renewalDateFormatted: renewalDate.toLocaleDateString("ar-SA"),
        daysUntil: days,
        status: days <= 30 ? "عاجل" : days <= 90 ? "قريب" : "بعيد",
      };
    });
    return Response.json(renewals);
  }

  // POST /api/send-monthly-report
  if (path === "send-monthly-report" && method === "POST") {
    return Response.json({ success: true, message: "تم إرسال التقرير (محاكي)" });
  }

  // 404 for unknown routes
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};
