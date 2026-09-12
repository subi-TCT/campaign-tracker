import React, { useState, useEffect, useMemo } from 'react';
import {
  Cake,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Users,
  CheckCircle,
  AlertCircle,
  Send,
  Download,
  Search,
  Sparkles,
  ChevronRight,
  Filter,
  RefreshCw,
  Award,
  Droplet,
  ExternalLink,
  MapPin,
  Heart
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BirthdayCelebrantsHub({
  API_BASE,
  PHOTO_BASE,
  authToken,
  currentUser,
  onSelectContact,
  onRefreshBadge
}) {
  // Navigation sub-tab: 'today' | 'next7' | 'monthly' | 'settings'
  const [subTab, setSubTab] = useState('today');

  // Overview data from GET /api/birthdays/overview
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Month directory state
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1); // 1-12
  const [monthData, setMonthData] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthSearch, setMonthSearch] = useState('');
  const [monthDistrictFilter, setMonthDistrictFilter] = useState('All');

  // Next 7 days state
  const [next7Data, setNext7Data] = useState(null);
  const [next7Loading, setNext7Loading] = useState(false);

  // Action status messages
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingSingleId, setSendingSingleId] = useState(null);

  // Test email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Initial load
  useEffect(() => {
    fetchOverview();
  }, []);

  // When subTab or selectedMonth changes
  useEffect(() => {
    if (subTab === 'monthly') {
      fetchMonthData(selectedMonth);
    } else if (subTab === 'next7') {
      fetchNext7Data();
    }
  }, [subTab, selectedMonth]);

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/birthdays/overview`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
        if (onRefreshBadge && data.today) {
          onRefreshBadge(data.today.totalToday);
        }
      }
    } catch (err) {
      console.error('Failed to fetch birthday overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchMonthData = async (monthNum) => {
    setMonthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/birthdays/by-month/${monthNum}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMonthData(data);
      }
    } catch (err) {
      console.error('Failed to fetch month birthdays:', err);
    } finally {
      setMonthLoading(false);
    }
  };

  const fetchNext7Data = async () => {
    setNext7Loading(true);
    try {
      const res = await fetch(`${API_BASE}/birthdays/next-7-days`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNext7Data(data);
      }
    } catch (err) {
      console.error('Failed to fetch next 7 days birthdays:', err);
    } finally {
      setNext7Loading(false);
    }
  };

  // Dispatch emails to all pending celebrants today
  const handleSendTodayAll = async () => {
    setSendingAll(true);
    setActionMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/birthdays/send-today`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({
          type: 'success',
          text: `🎉 Successfully dispatched birthday greetings! Sent: ${data.sent || 0}, Failed: ${data.failed || 0}`
        });
        await fetchOverview();
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to dispatch birthday emails.' });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSendingAll(false);
    }
  };

  // Dispatch birthday email to a single contact
  const handleSendSingle = async (contact) => {
    setSendingSingleId(contact.id);
    setActionMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/birthdays/send-single/${contact.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({
          type: 'success',
          text: `🎉 Birthday greeting delivered to ${contact.account_name} (${contact.email_id})!`
        });
        await fetchOverview();
        if (subTab === 'monthly') await fetchMonthData(selectedMonth);
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to send greeting.' });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSendingSingleId(null);
    }
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await fetch(`${API_BASE}/birthdays/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ email: testEmailAddress.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Test celebratory card delivered to ${testEmailAddress}! Check your inbox.`);
      } else {
        alert(`Error: ${data.error || 'Could not dispatch test email.'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Generate personalized WhatsApp Birthday greeting text
  const generateWhatsAppMessage = (contact, isAdvance = false) => {
    const name = contact.account_name || 'Esteemed Member';
    if (isAdvance) {
      return encodeURIComponent(
`🎂 *Advance Birthday Greetings!* 💐

Dear *${name}*,

Wishing you in advance a joyous and blessed upcoming birthday! May this milestone year bring you robust health, continued happiness, and enduring success.

With warm regards & highest esteem,
*Anil Kumar K G Pillai* (Candidate #3 - Managing Committee)
& The Joint 7-Candidate Democratic Panel, Indian Association Sharjah.`
      );
    }

    return encodeURIComponent(
`🎂 *Happy Birthday ${name}!* 💐

On this blessed milestone occasion of your birthday, we extend our heartfelt felicitations, warmest prayers, and deepest appreciation to you and your family!

May the Almighty bless you with vibrant health, peace, prosperity, and boundless joy in all your endeavors.

With warmest regards & best wishes,
*Anil Kumar K G Pillai* (Candidate #3 - Managing Committee)
& The Joint 7-Candidate Democratic Panel, Indian Association Sharjah.`
    );
  };

  // Clean phone number for WhatsApp link
  const getWhatsAppLink = (contact, isAdvance = false) => {
    let phone = String(contact.mobile_number || '').replace(/\D/g, '');
    if (phone.startsWith('05')) phone = '971' + phone.substring(1);
    else if (phone.startsWith('5')) phone = '971' + phone;
    return `https://wa.me/${phone}?text=${generateWhatsAppMessage(contact, isAdvance)}`;
  };

  // Filtered month celebrants
  const filteredMonthMembers = useMemo(() => {
    if (!monthData?.members) return [];
    let list = monthData.members;

    if (monthDistrictFilter !== 'All') {
      list = list.filter(m => m.district === monthDistrictFilter);
    }

    if (monthSearch.trim()) {
      const q = monthSearch.toLowerCase().trim();
      list = list.filter(m =>
        (m.account_name && m.account_name.toLowerCase().includes(q)) ||
        (m.acc_code && m.acc_code.toLowerCase().includes(q)) ||
        (m.mobile_number && m.mobile_number.includes(q))
      );
    }

    return list;
  }, [monthData, monthDistrictFilter, monthSearch]);

  // Unique districts in current month
  const uniqueMonthDistricts = useMemo(() => {
    if (!monthData?.members) return [];
    const set = new Set(monthData.members.map(m => m.district).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [monthData]);

  // Export Month Celebrants to Excel
  const handleExportMonthExcel = async () => {
    if (!filteredMonthMembers || filteredMonthMembers.length === 0) {
      alert('No celebrants to export for this selection.');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const exportRows = filteredMonthMembers.map(m => ({
        'Day': m.day,
        'Birthday Date': m.formattedDate,
        'IAS ID': m.acc_code,
        'Member Name': m.account_name,
        'Age Turning': m.turningAge || 'N/A',
        'Mobile (UAE)': m.mobile_number,
        'Email': m.email_id || 'N/A',
        'Home District': m.district,
        'Emirate': m.emirate,
        'Blood Group': m.blood_group || 'N/A'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, `${MONTH_NAMES[selectedMonth - 1]} Celebrants`);
      XLSX.writeFile(wb, `IAS_${MONTH_NAMES[selectedMonth - 1]}_Birthday_Celebrants.xlsx`);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="tab-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.15)', padding: 8, borderRadius: 10, color: '#ec4899', display: 'flex' }}>
              <Cake size={26} />
            </div>
            <span>Birthday Celebrants Hub & Greeting Service</span>
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>
            Celebrate member milestones, dispatch candidate-branded WhatsApp wishes, and track upcoming voter birthdays.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={fetchOverview}
            disabled={overviewLoading}
            style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={overviewLoading ? 'spinning' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Action Message Alert Banner */}
      {actionMsg.text && (
        <div
          className={actionMsg.type === 'error' ? 'login-error-banner' : ''}
          style={
            actionMsg.type === 'success'
              ? {
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '12px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }
              : { padding: '12px 16px', borderRadius: 10 }
          }
        >
          {actionMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌟 3 TOP SUMMARY CARDS (TODAY, NEXT 7 DAYS, MONTHLY COUNTS) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* CARD 1: Today's Celebrants */}
        <div
          onClick={() => setSubTab('today')}
          style={{
            background: subTab === 'today'
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.22), rgba(168, 85, 247, 0.15))'
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(168, 85, 247, 0.05))',
            border: subTab === 'today' ? '2px solid #ec4899' : '1px solid rgba(236, 72, 153, 0.3)',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            boxShadow: subTab === 'today' ? '0 4px 20px rgba(236, 72, 153, 0.25)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f472b6', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <Cake size={16} /> Today's Celebrants
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-white)', marginTop: 8 }}>
                {overview?.today?.totalToday ?? 0}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#f472b6', marginLeft: 8 }}>
                  Member{overview?.today?.totalToday === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <span
              style={{
                background: 'rgba(236, 72, 153, 0.2)',
                color: '#f472b6',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {overview?.today?.formattedDate || 'Today'}
            </span>
          </div>

          {/* Sub-status breakdown */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, fontSize: 11 }}>
            <span style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              ✓ {overview?.today?.sentCount ?? 0} Sent
            </span>
            <span style={{ color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⏳ {overview?.today?.pendingCount ?? 0} Pending
            </span>
            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              📵 {overview?.today?.noEmailCount ?? 0} No Email
            </span>
          </div>
        </div>

        {/* CARD 2: Next Coming 7 Days Celebrants */}
        <div
          onClick={() => setSubTab('next7')}
          style={{
            background: subTab === 'next7'
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(59, 130, 246, 0.15))'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(59, 130, 246, 0.05))',
            border: subTab === 'next7' ? '2px solid #6366f1' : '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            boxShadow: subTab === 'next7' ? '0 4px 20px rgba(99, 102, 241, 0.25)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#818cf8', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <Calendar size={16} /> Next Coming 7 Days
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-white)', marginTop: 8 }}>
                {overview?.next7Days?.count ?? 0}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#818cf8', marginLeft: 8 }}>Celebrants</span>
              </div>
            </div>

            <span
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700
              }}
            >
              7-Day Schedule
            </span>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color="#818cf8" />
            <span>Click to browse day-by-day upcoming timeline</span>
          </div>
        </div>

        {/* CARD 3: Monthly Celebrants Counts */}
        <div
          onClick={() => setSubTab('monthly')}
          style={{
            background: subTab === 'monthly'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(20, 184, 166, 0.15))'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(20, 184, 166, 0.05))',
            border: subTab === 'monthly' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 14,
            padding: '18px 20px',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            boxShadow: subTab === 'monthly' ? '0 4px 20px rgba(16, 185, 129, 0.25)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <Sparkles size={16} /> Monthly Celebrants Counts
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-text-white)', marginTop: 8 }}>
                {overview?.currentMonth?.count ?? 0}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#34d399', marginLeft: 8 }}>
                  in {overview?.currentMonth?.name || 'This Month'}
                </span>
              </div>
            </div>

            <span
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700
              }}
            >
              12-Month Directory
            </span>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={13} color="#34d399" />
            <span>Total registered with DOB: <strong>{overview?.totalCelebrantsWithDob || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🧭 NAVIGATION SUB-TABS */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          className={`btn ${subTab === 'today' ? 'primary' : ''}`}
          onClick={() => setSubTab('today')}
          style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: '8px 8px 0 0' }}
        >
          <Cake size={16} color={subTab === 'today' ? '#fff' : '#ec4899'} />
          Today's Celebrants ({overview?.today?.totalToday ?? 0})
        </button>

        <button
          className={`btn ${subTab === 'next7' ? 'primary' : ''}`}
          onClick={() => setSubTab('next7')}
          style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: '8px 8px 0 0' }}
        >
          <Calendar size={16} color={subTab === 'next7' ? '#fff' : '#818cf8'} />
          Next 7 Days ({overview?.next7Days?.count ?? 0})
        </button>

        <button
          className={`btn ${subTab === 'monthly' ? 'primary' : ''}`}
          onClick={() => setSubTab('monthly')}
          style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: '8px 8px 0 0' }}
        >
          <Users size={16} color={subTab === 'monthly' ? '#fff' : '#34d399'} />
          12-Month Calendar & Directory
        </button>

        <button
          className={`btn ${subTab === 'settings' ? 'primary' : ''}`}
          onClick={() => setSubTab('settings')}
          style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: '8px 8px 0 0', marginLeft: 'auto' }}
        >
          <Mail size={16} />
          Greeting Preview & Automation
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🍰 SUB-TAB 1: TODAY'S CELEBRANTS */}
      {/* ========================================================================= */}
      {subTab === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Header Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: 'rgba(236, 72, 153, 0.06)',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              borderRadius: 12,
              padding: '14px 18px'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text-white)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#ec4899" />
                Voters Celebrating Today ({overview?.today?.formattedDate || 'Today'})
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Reach out personally via candidate-branded WhatsApp greetings, direct calls, or automated HTML greeting cards.
              </p>
            </div>

            {overview?.today?.pendingCount > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendTodayAll}
                disabled={sendingAll}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                  border: 'none',
                  boxShadow: '0 2px 10px rgba(236, 72, 153, 0.35)'
                }}
              >
                <Send size={14} className={sendingAll ? 'spinning' : ''} />
                {sendingAll ? 'Dispatching...' : `Send Email Wishes to All (${overview?.today?.pendingCount})`}
              </button>
            )}
          </div>

          {/* Celebrants Grid */}
          {overview?.today?.members?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <Cake size={48} color="#f472b6" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--color-text-white)' }}>No Birthdays Recorded for Today</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 6 }}>
                Check the <strong>Next 7 Days</strong> tab above to view upcoming celebrants and send advance greetings!
              </p>
              <button className="btn primary" onClick={() => setSubTab('next7')} style={{ marginTop: 12, fontSize: 12 }}>
                View Next 7 Days Schedule
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {overview?.today?.members?.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Top card info */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Photo / Avatar */}
                    {m.photo_filename ? (
                      <img
                        src={`${PHOTO_BASE}/${encodeURIComponent(m.photo_filename)}`}
                        alt={m.account_name}
                        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ec4899' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700 }}>
                        {m.account_name ? m.account_name.charAt(0).toUpperCase() : 'M'}
                      </div>
                    )}

                    <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-white)' }}>
                          {m.account_name}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 600 }}>
                          {m.acc_code}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {m.district && <span><MapPin size={11} style={{ verticalAlign: 'middle' }} /> {m.district}</span>}
                        {m.turningAge && (
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontWeight: 700 }}>
                            Age: {m.turningAge}
                          </span>
                        )}
                        {m.blood_group && (
                          <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 700 }}>
                            {m.blood_group}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Channels Info */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, padding: '8px 12px', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {m.mobile_number || 'No phone recorded'}
                    </span>
                    <span style={{ color: m.birthdaySentThisYear ? '#34d399' : '#fbbf24', fontWeight: 600, fontSize: 10 }}>
                      {m.birthdaySentThisYear ? '✓ Email Sent (2026)' : '⏳ Email Pending'}
                    </span>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {/* 1-Click WhatsApp Button */}
                    <a
                      href={getWhatsAppLink(m, false)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(37, 211, 102, 0.15)',
                        color: '#25d366',
                        border: '1px solid rgba(37, 211, 102, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        textDecoration: 'none'
                      }}
                    >
                      <MessageSquare size={13} /> WhatsApp Wish
                    </a>

                    {/* Direct Call Button */}
                    {m.mobile_number ? (
                      <a
                        href={`tel:${m.mobile_number}`}
                        className="btn"
                        style={{
                          padding: '6px 10px',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          textDecoration: 'none'
                        }}
                      >
                        <Phone size={13} /> Call Voter
                      </a>
                    ) : (
                      <button className="btn" disabled style={{ opacity: 0.5, fontSize: 11 }}>
                        No Phone
                      </button>
                    )}
                  </div>

                  {/* Send Email Greeting */}
                  {m.hasEmail && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleSendSingle(m)}
                      disabled={sendingSingleId === m.id}
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: m.birthdaySentThisYear ? 'rgba(255, 255, 255, 0.05)' : 'rgba(168, 85, 247, 0.15)',
                        color: m.birthdaySentThisYear ? '#94a3b8' : '#c084fc',
                        border: '1px solid rgba(168, 85, 247, 0.3)'
                      }}
                    >
                      <Mail size={13} className={sendingSingleId === m.id ? 'spinning' : ''} />
                      {sendingSingleId === m.id
                        ? 'Sending Greeting...'
                        : m.birthdaySentThisYear
                        ? 'Re-send Email Greeting'
                        : 'Send Email Greeting'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📅 SUB-TAB 2: NEXT 7 DAYS CELEBRANTS TIMELINE */}
      {/* ========================================================================= */}
      {subTab === 'next7' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 12,
              padding: '14px 18px'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text-white)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="#818cf8" />
                Celebrants in the Next 7 Days ({next7Data?.count ?? overview?.next7Days?.count ?? 0} Members)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Sorted chronologically by days remaining. Plan call rounds or send advance WhatsApp greetings!
              </p>
            </div>
          </div>

          {next7Loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              Loading 7-day schedule...
            </div>
          ) : (next7Data?.members || overview?.next7Days?.members || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12 }}>
              No celebrants in the next 7 days.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {(next7Data?.members || overview?.next7Days?.members || []).map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: m.diffDays === 0 ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                          color: m.diffDays === 0 ? '#f472b6' : '#818cf8',
                          marginBottom: 4
                        }}
                      >
                        {m.relativeLabel} • {m.formattedDate} ({m.dayOfWeek})
                      </span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-white)' }}>
                        {m.account_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Code: {m.acc_code} • {m.district || 'District N/A'}
                        {m.turningAge ? ` • Turning ${m.turningAge}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <a
                      href={getWhatsAppLink(m, m.diffDays > 0)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(37, 211, 102, 0.15)',
                        color: '#25d366',
                        border: '1px solid rgba(37, 211, 102, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        textDecoration: 'none'
                      }}
                    >
                      <MessageSquare size={13} /> {m.diffDays === 0 ? 'WhatsApp Wish' : 'Advance Wish'}
                    </a>

                    {m.mobile_number && (
                      <a
                        href={`tel:${m.mobile_number}`}
                        className="btn"
                        style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                      >
                        <Phone size={13} /> Call
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗓️ SUB-TAB 3: 12-MONTH CALENDAR & DIRECTORY */}
      {/* ========================================================================= */}
      {subTab === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 12 Months Selector Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {MONTH_NAMES.map((mName, idx) => {
              const monthNum = idx + 1;
              const count = overview?.monthlyCounts ? overview.monthlyCounts[idx]?.count : 0;
              const isSelected = selectedMonth === monthNum;
              return (
                <button
                  key={monthNum}
                  type="button"
                  onClick={() => setSelectedMonth(monthNum)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? '2px solid #10b981' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#34d399' : 'var(--color-text-white)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{mName.substring(0, 3)}</span>
                  <span style={{ fontSize: 10, color: isSelected ? '#34d399' : 'var(--color-text-muted)' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '10px 14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              {/* Search input */}
              <div style={{ position: 'relative', minWidth: 200, flex: 1, maxWidth: 300 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  className="drawer-input"
                  placeholder={`Search ${MONTH_NAMES[selectedMonth - 1]} celebrants...`}
                  value={monthSearch}
                  onChange={(e) => setMonthSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 12 }}
                />
              </div>

              {/* District filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>District:</span>
                <select
                  className="drawer-input"
                  value={monthDistrictFilter}
                  onChange={(e) => setMonthDistrictFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, width: 'auto' }}
                >
                  {uniqueMonthDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Month to Excel */}
            <button
              type="button"
              className="btn"
              onClick={handleExportMonthExcel}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <Download size={13} /> Export {MONTH_NAMES[selectedMonth - 1]} Excel
            </button>
          </div>

          {/* Month Celebrants Table */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>{MONTH_NAMES[selectedMonth - 1]} Celebrants ({filteredMonthMembers.length})</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                Chronologically ordered by day of the month
              </span>
            </div>

            {monthLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={20} className="spinning" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Loading {MONTH_NAMES[selectedMonth - 1]} celebrants...
              </div>
            ) : filteredMonthMembers.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No celebrants found matching your search in {MONTH_NAMES[selectedMonth - 1]}.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Member Name & ID</th>
                      <th style={{ padding: '10px 12px' }}>Age Milestone</th>
                      <th style={{ padding: '10px 12px' }}>District</th>
                      <th style={{ padding: '10px 12px' }}>Mobile (UAE)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonthMembers.map((m) => (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#34d399' }}>
                          {m.formattedDate}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>
                            {m.account_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {m.acc_code}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {m.turningAge ? (
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontSize: 10, fontWeight: 700 }}>
                              Age: {m.turningAge}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                          {m.district || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                          {m.mobile_number || '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {m.mobile_number && (
                              <a
                                href={getWhatsAppLink(m, true)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn"
                                title="Send WhatsApp Birthday Greeting"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'rgba(37, 211, 102, 0.15)',
                                  color: '#25d366',
                                  border: '1px solid rgba(37, 211, 102, 0.3)',
                                  textDecoration: 'none'
                                }}
                              >
                                <MessageSquare size={12} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ⚙️ SUB-TAB 4: GREETING PREVIEW & AUTOMATION */}
      {/* ========================================================================= */}
      {subTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Card Preview */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--color-text-white)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color="#c084fc" /> HTML Email Greeting Card Preview
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              This celebratory card is automatically dispatched to celebrants on their birthday at 08:00 AM GST.
            </p>

            <div
              style={{
                background: '#ffffff',
                color: '#1e293b',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎂 ✨ 💐</div>
              <h2 style={{ margin: '0 0 8px 0', color: '#4338ca', fontSize: 20, fontWeight: 800 }}>
                HAPPY BIRTHDAY!
              </h2>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                Dear Esteemed Member,
              </div>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                On this wonderful milestone occasion of your birthday, we extend our heartfelt felicitations, warmest wishes, and deepest appreciation to you and your loved ones.
              </p>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, fontSize: 12, color: '#64748b' }}>
                <strong>With Warmest Felicitations & Respect,</strong><br />
                <span style={{ color: '#4338ca', fontWeight: 700 }}>Anil Kumar K G Pillai & The Joint 7-Candidate Democratic Panel</span><br />
                Indian Association Sharjah
              </div>
            </div>
          </div>

          {/* Test Sender & Scheduler Info */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: 'var(--color-text-white)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={16} color="#34d399" /> Send Test Birthday Greeting
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Dispatch a sample greeting card to test SMTP delivery to your inbox.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="email"
                className="drawer-input"
                placeholder="Enter recipient email (e.g. director@campaign.com)"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                style={{ fontSize: 12 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail}
                style={{ padding: '8px 16px', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Send size={13} className={sendingTestEmail ? 'spinning' : ''} />
                {sendingTestEmail ? 'Sending...' : 'Send Test Card to Inbox'}
              </button>
            </div>

            {/* Automation Status */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: 'var(--color-text-white)' }}>
                Automated Background Scheduler
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                • Cron Schedule: <strong>Daily at 08:00 AM GST</strong> (<code>0 8 * * *</code>)<br />
                • Automated Duplicate Protection: Records <code>birthday_sent_year = 2026</code> so no member ever receives duplicate wishes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
