import { prisma } from '@/lib/db';
import { Calendar, Users, DollarSign, Activity, LogOut, Phone, Trash2, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { getAllTodayAppointments } from '@/lib/services/google-calendar';
import { getTodayBookings } from '@/lib/services/square';
import AdminActionButton from '@/components/AdminActionButton';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard(props: { searchParams: Promise<{ date?: string, month?: string }> }) {
  const searchParams = await props.searchParams;
  // Cookie-based auth check
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);

  if (!sessionCookie?.value) {
    redirect('/admin/login');
  }

  const session = verifySessionToken(sessionCookie.value);
  if (!session) {
    redirect('/admin/login');
  }

  // 1. Determine Date Filter
  const selectedDateStr = searchParams.date;
  const selectedMonthStr = searchParams.month; // e.g. "2026-03"

  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  let endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  if (selectedDateStr) {
    startDate = new Date(selectedDateStr + 'T00:00:00');
    endDate = new Date(selectedDateStr + 'T23:59:59');
  } else if (selectedMonthStr) {
    const [year, month] = selectedMonthStr.split('-').map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59);
  }

  // 2. Fetch Stats based on filter
  const checkInsCount = await prisma.checkInLog.count({
    where: { check_in_time: { gte: startDate, lte: endDate } }
  });

  const transactionsAgg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { created_at: { gte: startDate, lte: endDate }, status: 'COMPLETED' }
  });
  const revenue = transactionsAgg._sum.amount ? parseFloat(transactionsAgg._sum.amount.toString()) : 0;

  // Global stats (still useful)
  const totalPatients = await prisma.patient.count();
  const allTransactions = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'COMPLETED' }
  });
  const lifetimeRevenue = allTransactions._sum.amount ? parseFloat(allTransactions._sum.amount.toString()) : 0;

  // 3. Fetch Recent Check-Ins for the selected period
  const filteredCheckIns = await prisma.checkInLog.findMany({
    where: { check_in_time: { gte: startDate, lte: endDate } },
    orderBy: { check_in_time: 'desc' },
    take: 50,
    include: { patient: true }
  });

  // 4. Fetch Appointments from External Sources
  const googleAppts = await getAllTodayAppointments(selectedDateStr);
  const squareApptsRaw = await getTodayBookings(selectedDateStr) as any[];

  // 5. Combine and Format Appointments
  const allScheduled = [
    ...googleAppts.map(a => ({
      ...a,
      id: a.eventId,
      type: 'google-calendar',
      patientName: a.title.replace('Eye Care Appointment - ', ''),
      phone: '', // Google Calendar might have it in description, but keeping it empty for now
    })),
    ...squareApptsRaw.map(b => ({
      id: b.id,
      title: 'Square Booking',
      startTime: b.startAt,
      type: 'square-bookings',
      patientName: b.customerName || 'Customer',
      phone: b.customerPhone || '',
      source: 'square',
      endTime: b.startAt,
      location: 'Clinic',
      eventId: b.id
    }))
  ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // 6. Enrichment: Check if arrived
  // We match by name (rough) or we could improve this with email lookups
  const checkArrived = (apptPatientName: string) => {
    return filteredCheckIns.some((ci: any) => 
      `${ci.patient.first_name} ${ci.patient.last_name}`.toLowerCase().includes(apptPatientName.toLowerCase()) ||
      apptPatientName.toLowerCase().includes(ci.patient.last_name.toLowerCase())
    );
  };

  const displayDateLabel = selectedDateStr || selectedMonthStr || "Today";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-600 pl-3">
            Clinic Dashboard
          </h1>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Check-In Kiosk
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium ml-4"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Filters: <span className="text-blue-600 font-normal ml-1">{displayDateLabel}</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <form className="flex items-center gap-2">
              <label htmlFor="date" className="text-xs font-bold text-gray-400 uppercase tracking-widest">By Day:</label>
              <input 
                type="date" 
                id="date" 
                name="date" 
                defaultValue={selectedDateStr}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">Apply Day</button>
            </form>

            <div className="h-8 w-px bg-gray-200 mx-2" />

            <form className="flex items-center gap-2">
              <label htmlFor="month" className="text-xs font-bold text-gray-400 uppercase tracking-widest">By Month:</label>
              <input 
                type="month" 
                id="month" 
                name="month" 
                defaultValue={selectedMonthStr}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Apply Month</button>
            </form>
            
            {(selectedDateStr || selectedMonthStr) && (
              <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest ml-4">Reset</Link>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Check-Ins ({displayDateLabel})</p>
              <h3 className="text-2xl font-bold text-gray-900">{checkInsCount}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
            <div className="p-3 rounded-full bg-green-50 text-green-600 mr-4">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Revenue ({displayDateLabel})</p>
              <h3 className="text-2xl font-bold text-gray-900">${revenue.toFixed(2)}</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center shadow-lg shadow-indigo-500/5">
            <div className="p-3 rounded-full bg-indigo-50 text-indigo-600 mr-4">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Patients</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalPatients}</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center shadow-lg shadow-amber-500/5">
            <div className="p-3 rounded-full bg-amber-50 text-amber-600 mr-4">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Lifetime Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900">${lifetimeRevenue.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        {/* Scheduled Appointments Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-blue-50/30">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Scheduled Today ({displayDateLabel})
            </h3>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{allScheduled.length} Appointments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Patient</th>
                  <th className="px-6 py-4 font-medium">Source</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allScheduled.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      No external appointments found for {displayDateLabel}.
                    </td>
                  </tr>
                ) : (
                  allScheduled.map((appt) => {
                    const arrived = checkArrived(appt.patientName);
                    return (
                      <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {appt.patientName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                          {appt.type === 'google-calendar' ? 'Google' : 'Square'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {arrived ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Arrived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-xs uppercase tracking-wider">
                              <Clock className="w-3.5 h-3.5" /> No-show
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                          {/* Call Reminder */}
                          <AdminActionButton
                            action="/api/admin/appointments/remind"
                            fields={{ 
                              phone: appt.phone || "5551234567", 
                              patientName: appt.patientName,
                              appointmentTime: new Date(appt.startTime).toLocaleTimeString()
                            }}
                            title="Send Voice Reminder"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                          </AdminActionButton>
                          
                          {/* Cancel Appointment */}
                          <AdminActionButton
                            action="/api/admin/appointments/cancel"
                            fields={{ eventId: appt.id, source: appt.type }}
                            confirmMessage="Cancel this appointment?"
                            title="Cancel Appointment"
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </AdminActionButton>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-800">Check-In Activity Log</h3>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Showing last 50 results</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Patient Name</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Reason</th>
                  <th className="px-6 py-4 font-medium">Payment</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCheckIns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No check-ins found for {displayDateLabel}.
                    </td>
                  </tr>
                ) : (
                  filteredCheckIns.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs mr-3">
                            {log.patient.first_name[0]}{log.patient.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{log.patient.first_name} {log.patient.last_name}</p>
                            <p className="text-xs text-gray-500">{log.patient.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex flex-col">
                          <span>{log.check_in_time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          <span className="text-xs text-gray-400">{log.check_in_time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.reason_for_visit || 'Routine Exam'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                          log.payment_status === 'PAID' 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : log.payment_status === 'UNPAID'
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {log.payment_status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                          log.status === 'WAITING' 
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {log.status === 'WAITING' ? 'Waiting' : 'Seen'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                        {log.status === 'WAITING' && (
                          <AdminActionButton
                            action="/api/admin/checkin/status/form-action"
                            fields={{ checkInId: String(log.id), status: 'COMPLETED' }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            Mark Seen
                          </AdminActionButton>
                        )}
                        <AdminActionButton
                          action="/api/admin/checkin/delete"
                          fields={{ checkInId: String(log.id) }}
                          confirmMessage="Are you sure you want to delete this check-in record? This will not cancel any calendar appointments."
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-red-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </AdminActionButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
