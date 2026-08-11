import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, Phone, MessageSquare, AlertTriangle, Search, 
  ChevronLeft, ChevronRight, CheckCircle, Clock, Edit2, 
  Plus, FileText, Settings, HelpCircle, Save, ExternalLink,
  Sun, Moon, Upload, AlertCircle, X, Vote, Award, BarChart2, Map, Menu
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Pre-election Sentiment Legend Configurations
const SENTIMENT_META = {
  strong: { label: 'Strong Support (Panel)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  leaning: { label: 'Leaning (Anil Kumar only)', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)' },
  undecided: { label: 'Undecided / Follow-up', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  opposed: { label: 'Opposed', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  unknown: { label: 'Unknown / Uncontacted', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }
};

// Campaign candidates with posts & serial numbers
const CAMPAIGN_CANDIDATES = [
  { sno: 2, name: "K.BALAKRISHNAN (BALAN)", post: "President", initials: "KB", photo: "/candidates/balakrishnan.jpg" },
  { sno: 1, name: "PAVITHRAN NITTOOR", post: "Vice President", initials: "PN", photo: "/candidates/PAVITHRAN.jpg" },
  { sno: 1, name: "Adv. Y. A. RAHIM", post: "General Secretary", initials: "YR", photo: "/candidates/rahim.jpg" },
  { sno: 1, name: "Adv. ANSAR N T", post: "Joint Gen. Secretary", initials: "AN", photo: "/candidates/ansar..jpg" },
  { sno: 3, name: "SHAJI JOHN", post: "Treasurer", initials: "SJ", photo: "/candidates/shaji.jpg" },
  { sno: 1, name: "ANILAL PURUSHOTHAMAN", post: "Joint Treasurer", initials: "AP", photo: "/candidates/anilal.jpg" },
  { sno: 3, name: "THANIKACHAN MANDAPATHIL (CA)", post: "Auditor", initials: "TM", photo: "/candidates/THANIKACHAN.jpg" },
  { sno: 2, name: "ABHILASH RETNAKARAN", post: "Managing Committee Member", initials: "AR", photo: "/candidates/ABHILASH RETNAKARAN_L3651.png" },
  { sno: 3, name: "ANIL KUMAR K G PILLAI", post: "Managing Committee Member", initials: "AK", photo: "/candidates/anil.jpg" },
  { sno: 5, name: "BAVOO BASHEER. R (BAVOO BASHEER)", post: "Managing Committee Member", initials: "BB", photo: "/candidates/BAVOO BASHEER R._L2126.png" },
  { sno: 7, name: "JAFER KANNATE", post: "Managing Committee Member", initials: "JK", photo: "/candidates/JAFER KANNATE_L1684.png" },
  { sno: 17, name: "PUNNAKKAN MUHAMMED ALI (PUNNAKKAN)", post: "Managing Committee Member", initials: "PM", photo: "/candidates/PUNNAKKAN MUHAMMED ALI_L2786.png" },
  { sno: 18, name: "ROY MATHEW", post: "Managing Committee Member", initials: "RM", photo: "/candidates/ROY MATHEW_L2937.png" },
  { sno: 20, name: "SHANTY THOMAS CHERUVATHOOR", post: "Managing Committee Member", initials: "ST", photo: "/candidates/SHANTY THOMAS CHERUVATHOOR_L3206.png" }
];

export default function App() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Theme Management
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Searching & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Exit Poll specific search
  const [exitPollSearch, setExitPollSearch] = useState('');

  // Filters
  const [emailFilter, setEmailFilter] = useState('All');
  const [callFilter, setCallFilter] = useState('All');
  const [whatsappFilter, setWhatsappFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');

  // Selection for bulk actions
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  
  // Drawer / Modal states
  const [selectedContact, setSelectedContact] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', accCode: '', mobile: '', email: '' });
  const [waConfirmContact, setWaConfirmContact] = useState(null); // Contact currently sending WA to

  // Bulk Import Logs modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState('sent'); // 'sent' or 'failed'
  const [importRawText, setImportRawText] = useState('');
  const [importAnalysis, setImportAnalysis] = useState(null);

  // Exit poll win threshold
  const [exitPollTarget, setExitPollTarget] = useState(
    Number(localStorage.getItem('exit_poll_target')) || 1000
  );

  // Templates state (initialized with campaign defaults)
  const [templates, setTemplates] = useState({
    whatsapp: "Dear {Name},\n\nKindly support Anil Kumar K G Pillai (Managing Committee Candidate - Serial No. 3) & our 7-candidate panel for the Managing Committee Selection on Sep 6th, 2026 (8 AM onwards). Your valuable vote is critical for our success.\n\nThank you,\nCampaign Team",
    email: "Dear {Name},\n\nWe hope this email finds you well.\n\nWe kindly request your valuable vote and support for Anil Kumar K G Pillai (Managing Committee Candidate, Serial No. 3) and our 7-candidate panel in the upcoming Managing Committee Selection on Sunday, September 6, 2026.\n\nYour support will ensure strong leadership and progress.\n\nBest regards,\nCampaign Committee",
    callScript: "Hello {Name}, calling from the election committee. We request your support for Managing Committee candidate Anil Kumar K G Pillai (Serial No. 3) and our 7-candidate panel in the selection on September 6th at 8:00 AM. May we count on your support?"
  });

  // Panel Candidates (prefilled with our 7-candidate Managing Committee panel)
  const [panelCandidates, setPanelCandidates] = useState([
    { sno: 3, name: 'Anil Kumar K G Pillai', post: 'Managing Committee Member', isFeatured: true },
    { sno: 2, name: 'ABHILASH RETNAKARAN', post: 'Managing Committee Member', isFeatured: false },
    { sno: 5, name: 'BAVOO BASHEER. R (BAVOO BASHEER)', post: 'Managing Committee Member', isFeatured: false },
    { sno: 7, name: 'JAFER KANNATE', post: 'Managing Committee Member', isFeatured: false },
    { sno: 17, name: 'PUNNAKKAN MUHAMMED ALI', post: 'Managing Committee Member', isFeatured: false },
    { sno: 18, name: 'ROY MATHEW', post: 'Managing Committee Member', isFeatured: false },
    { sno: 20, name: 'SHANTY THOMAS CHERUVATHOOR', post: 'Managing Committee Member', isFeatured: false }
  ]);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Get Today's Date String
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Theme Toggling Effect
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist exit poll target
  useEffect(() => {
    localStorage.setItem('exit_poll_target', exitPollTarget);
  }, [exitPollTarget]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const today = getTodayString();
      const [contactsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/contacts`),
        fetch(`${API_BASE}/stats?today=${today}`)
      ]);

      if (!contactsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data from the server.');
      }

      const contactsData = await contactsRes.json();
      const statsData = await statsRes.json();

      setContacts(contactsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the local backend. Please ensure the backend server is running on http://localhost:3001.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    const targetDate = new Date('2026-09-06T08:00:00+04:00'); // Selection Date & Time
    
    const interval = setInterval(() => {
      const now = new Date();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Toggle Theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Safe tab selector that closes the mobile sidebar drawer
  const selectTab = (tabName, searchReset = false) => {
    setActiveTab(tabName);
    setMobileMenuOpen(false);
    if (searchReset) {
      setCurrentPage(1);
      setSearchQuery('');
    }
  };

  // Update contact status helper
  const updateContact = async (id, updates) => {
    try {
      const res = await fetch(`${API_BASE}/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Update failed');
      const updatedRow = await res.json();
      
      // Update local state
      setContacts(prev => prev.map(c => c.id === id ? updatedRow : c));
      
      // Refresh stats
      const today = getTodayString();
      const statsRes = await fetch(`${API_BASE}/stats?today=${today}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      return updatedRow;
    } catch (err) {
      console.error(err);
      alert('Error updating database. Check backend.');
    }
  };

  // Bulk update email status
  const handleBulkEmailUpdate = async (status, idsToUpdate = null) => {
    const ids = idsToUpdate || selectedContactIds;
    if (ids.length === 0) return;
    try {
      const today = getTodayString();
      const res = await fetch(`${API_BASE}/contacts/bulk-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          status,
          date: today
        })
      });
      if (!res.ok) throw new Error('Bulk update failed');
      
      // Clear selection & reload everything
      if (!idsToUpdate) setSelectedContactIds([]);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk update failed.');
    }
  };

  // Analyze Copy-Pasted Email List
  const handleAnalyzeImportText = () => {
    if (!importRawText.trim()) {
      alert('Please paste some email logs to analyze.');
      return;
    }

    const emailRegex = /[\w.-]+@[\w.-]+\.[\w.-]+/g;
    const foundEmails = (importRawText.match(emailRegex) || [])
      .map(e => e.toLowerCase().trim());
      
    const uniquePastedEmails = [...new Set(foundEmails)];

    if (uniquePastedEmails.length === 0) {
      alert('No valid email addresses found in the pasted text.');
      return;
    }

    const matchedContactsList = [];
    const unmatchedEmailAddresses = [];

    uniquePastedEmails.forEach(pastedEmail => {
      const matches = contacts.filter(c => c.email_id && c.email_id.toLowerCase().trim() === pastedEmail);
      if (matches.length > 0) {
        matchedContactsList.push(...matches);
      } else {
        unmatchedEmailAddresses.push(pastedEmail);
      }
    });

    setImportAnalysis({
      emailsFoundCount: uniquePastedEmails.length,
      matchedContacts: matchedContactsList,
      unmatchedEmails: unmatchedEmailAddresses
    });
  };

  // Execute Bulk Import Update
  const handleExecuteImport = async () => {
    if (!importAnalysis || importAnalysis.matchedContacts.length === 0) return;
    
    const targetStatus = importTab === 'sent' ? 'Sent' : 'Undelivered';
    const ids = importAnalysis.matchedContacts.map(c => c.id);
    
    await handleBulkEmailUpdate(targetStatus, ids);
    
    alert(`Successfully updated status to '${targetStatus}' for ${ids.length} matching contacts.`);
    setShowImportModal(false);
    setImportRawText('');
    setImportAnalysis(null);
  };

  // Edit Candidate Details
  const handleEditCandidate = (index, field, value) => {
    setPanelCandidates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Add Contact Handler
  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.name || !newContact.mobile) {
      alert('Name and Mobile Number are required.');
      return;
    }
    const nextSNo = contacts.length > 0 ? Math.max(...contacts.map(c => c.s_no || 0)) + 1 : 1;
    
    try {
      const res = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s_no: nextSNo,
          acc_code: newContact.accCode,
          account_name: newContact.name,
          mobile_number: newContact.mobile,
          email_id: newContact.email
        })
      });

      if (!res.ok) throw new Error('Failed to add contact');
      
      setShowAddModal(false);
      setNewContact({ name: '', accCode: '', mobile: '', email: '' });
      await fetchData();
      alert('Contact added successfully!');
    } catch (err) {
      console.error(err);
      alert('Error adding contact.');
    }
  };

  // Format message text by replacing tags
  const formatTemplateMessage = (templateText, contact) => {
    if (!contact) return '';
    return templateText
      .replace(/{Name}/g, contact.account_name)
      .replace(/{AccCode}/g, contact.acc_code)
      .replace(/{SerialNo}/g, contact.s_no);
  };

  // WhatsApp click handler
  const handleWhatsAppClick = (contact) => {
    const rawMsg = formatTemplateMessage(templates.whatsapp, contact);
    const encoded = encodeURIComponent(rawMsg);
    const cleanMobile = contact.mobile_number.replace(/\D/g, '');
    const url = `https://wa.me/${cleanMobile}?text=${encoded}`;
    
    window.open(url, '_blank');
    setWaConfirmContact(contact);
  };

  const confirmWhatsAppStatus = async (status, sentiment = null) => {
    if (!waConfirmContact) return;
    const today = getTodayString();
    const updates = {
      whatsapp_status: status,
      whatsapp_sent_date: status === 'Sent' || status === 'Delivered' ? today : ''
    };
    if (sentiment) {
      updates.member_reaction = sentiment;
    }
    await updateContact(waConfirmContact.id, updates);
    setWaConfirmContact(null);
  };

  // Export CSV helper
  const handleExportCSV = (exportFiltered = false) => {
    const listToExport = exportFiltered ? filteredContacts : contacts;
    if (listToExport.length === 0) return;
    
    const headers = ['S.No', 'AccCode', 'AccountName', 'Mobile Number', 'Email ID', 'Email Status', 'Email Sent Date', 'WhatsApp Status', 'Call Status', 'Call Sent Date', 'Notes', 'Voter Sentiment', 'Exit Poll Status'];
    const rows = listToExport.map(c => [
      c.s_no,
      c.acc_code,
      c.account_name,
      c.mobile_number,
      c.email_id,
      c.email_status,
      c.email_sent_date,
      c.whatsapp_status,
      c.call_status,
      c.call_sent_date,
      c.notes,
      c.member_reaction || 'Unknown',
      c.exit_poll_status || 'Pending'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    let filename = "campaign_outreach_report.csv";
    if (exportFiltered) {
      if (activeTab === 'quality') {
        filename = `data_integrity_${qualityFilter.toLowerCase().replace(' ', '_')}_contacts.csv`;
      } else if (activeTab === 'email') {
        filename = `email_campaign_${emailFilter.toLowerCase()}_contacts.csv`;
      } else if (activeTab === 'call') {
        filename = `call_center_${callFilter.toLowerCase().replace(' ', '_')}_contacts.csv`;
      } else if (activeTab === 'whatsapp') {
        filename = `whatsapp_campaign_${whatsappFilter.toLowerCase()}_contacts.csv`;
      } else {
        filename = `campaign_${activeTab}_filtered_contacts.csv`;
      }
    }
    
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Edit Drawer
  const handleOpenDrawer = (contact) => {
    setSelectedContact({ ...contact });
    setIsDrawerOpen(true);
  };

  const handleSaveDrawerDetails = async () => {
    if (!selectedContact) return;
    await updateContact(selectedContact.id, {
      account_name: selectedContact.account_name,
      acc_code: selectedContact.acc_code,
      mobile_number: selectedContact.mobile_number,
      email_id: selectedContact.email_id,
      email_status: selectedContact.email_status,
      email_sent_date: selectedContact.email_sent_date,
      whatsapp_status: selectedContact.whatsapp_status,
      call_status: selectedContact.call_status,
      call_sent_date: selectedContact.call_sent_date,
      notes: selectedContact.notes,
      member_reaction: selectedContact.member_reaction,
      exit_poll_status: selectedContact.exit_poll_status
    });
    setIsDrawerOpen(false);
  };

  // Filter Contacts
  const getFilteredContacts = () => {
    let list = [...contacts];

    // Search query matching
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.account_name && c.account_name.toLowerCase().includes(q)) ||
        (c.acc_code && c.acc_code.toLowerCase().includes(q)) ||
        (c.mobile_number && c.mobile_number.includes(q)) ||
        (c.email_id && c.email_id.toLowerCase().includes(q))
      );
    }

    // Tab-specific filters
    if (activeTab === 'email') {
      if (emailFilter !== 'All') {
        list = list.filter(c => c.email_status === emailFilter);
      }
    } else if (activeTab === 'call') {
      if (callFilter !== 'All') {
        list = list.filter(c => c.call_status === callFilter);
      }
    } else if (activeTab === 'whatsapp') {
      if (whatsappFilter !== 'All') {
        list = list.filter(c => c.whatsapp_status === whatsappFilter);
      }
    } else if (activeTab === 'quality') {
      if (qualityFilter === 'Missing Email') {
        list = list.filter(c => !c.email_id);
      } else if (qualityFilter === 'Duplicate Email') {
        const emails = list.map(c => c.email_id).filter(e => e);
        const dups = emails.filter((item, index) => emails.indexOf(item) !== index);
        list = list.filter(c => c.email_id && dups.includes(c.email_id));
      } else if (qualityFilter === 'Duplicate Mobile') {
        const mobiles = list.map(c => c.mobile_number).filter(m => m);
        const dups = mobiles.filter((item, index) => mobiles.indexOf(item) !== index);
        list = list.filter(c => c.mobile_number && dups.includes(c.mobile_number));
      }
    }

    return list;
  };

  const filteredContacts = getFilteredContacts();
  const totalItems = filteredContacts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Exit Poll rapid filter matching
  const getExitPollMatches = () => {
    if (!exitPollSearch.trim()) return [];
    const q = exitPollSearch.toLowerCase().trim();
    return contacts.filter(c => 
      (c.acc_code && c.acc_code.toLowerCase().includes(q)) ||
      (c.account_name && c.account_name.toLowerCase().includes(q))
    ).slice(0, 10); // Limit to top 10 for rapid visibility and performance
  };

  const exitPollMatches = getExitPollMatches();

  // Toggle selection for bulk actions
  const toggleContactSelect = (id) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const paginatedIds = paginatedContacts.map(c => c.id);
    const allSelected = paginatedIds.every(id => selectedContactIds.includes(id));
    if (allSelected) {
      setSelectedContactIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedContactIds(prev => [...new Set([...prev, ...paginatedIds])]);
    }
  };

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center', background: '#0b0c10', color: '#f3f4f6' }}>
        <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Connection Error</h2>
        <p style={{ color: '#9ca3af', maxWidth: 500, marginBottom: 24 }}>{error}</p>
        <button onClick={fetchData} className="btn primary">Retry Connection</button>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0c10', color: '#f3f4f6' }}>
        <div style={{ width: 48, height: 48, border: '4px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }}></div>
        <p style={{ color: '#9ca3af' }}>Loading Campaign database & statistics...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const emailTarget = 2000;
  const emailsSentToday = stats.email.sentToday || 0;
  const emailProgressPct = Math.min((emailsSentToday / emailTarget) * 100, 100);

  // Exit Poll calculations
  const securedVotes = stats.exitPoll.secured || 0;
  const exitPollProgressPct = Math.min((securedVotes / exitPollTarget) * 100, 100);

  // SVG Donut Chart calculation values
  const rReaction = stats.reactions;
  const reactionValues = [
    { key: 'strong', value: rReaction.strong, ...SENTIMENT_META.strong },
    { key: 'leaning', value: rReaction.leaning, ...SENTIMENT_META.leaning },
    { key: 'undecided', value: rReaction.undecided, ...SENTIMENT_META.undecided },
    { key: 'opposed', value: rReaction.opposed, ...SENTIMENT_META.opposed },
    { key: 'unknown', value: rReaction.unknown, ...SENTIMENT_META.unknown }
  ];
  
  const totalSentimentResponses = reactionValues.reduce((sum, item) => sum + item.value, 0) || 1;

  // Compute circles positions for SVG Donut
  let accumulatedPct = 0;
  const donutSlices = reactionValues.map(item => {
    const percentage = (item.value / totalSentimentResponses) * 100;
    const strokeDasharray = `${percentage} ${100 - percentage}`;
    const strokeDashoffset = 100 - accumulatedPct + 25; // Rotated offset (start at 12 o'clock)
    accumulatedPct += percentage;
    return { ...item, strokeDasharray, strokeDashoffset, percentage };
  });

  return (
    <div className="app-container">
      {/* Mobile Top Bar Header */}
      <header className="mobile-header">
        <button className="menu-toggle-btn" onClick={() => setMobileMenuOpen(prev => !prev)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="mobile-brand">
          <span className="brand-logo-small">AK</span>
          <span className="brand-title-small">Anil Kumar K G P</span>
        </div>
        <div style={{ width: 24 }}></div> {/* Balance layout */}
      </header>

      {/* Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div className="mobile-sidebar-overlay" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-logo">AK</div>
          <div className="brand-name">
            <h1>Anil Kumar K G P</h1>
            <span>Campaign Center</span>
          </div>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="nav-menu">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => selectTab('dashboard', true)}>
                <Users size={18} />
                Dashboard Overview
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'excelDashboard' ? 'active' : ''}`} onClick={() => selectTab('excelDashboard')}>
                <BarChart2 size={18} />
                Detailed Analytics
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'exitpoll' ? 'active' : ''}`} onClick={() => { selectTab('exitpoll'); setExitPollSearch(''); }}>
                <Vote size={18} />
                Exit Poll (Sep 6)
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'candidates' ? 'active' : ''}`} onClick={() => selectTab('candidates')}>
                <Award size={18} />
                Our Candidates
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'email' ? 'active' : ''}`} onClick={() => selectTab('email', true)}>
                <Mail size={18} />
                Email Campaign
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'call' ? 'active' : ''}`} onClick={() => selectTab('call', true)}>
                <Phone size={18} />
                Call Center
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => selectTab('whatsapp', true)}>
                <MessageSquare size={18} />
                WhatsApp Campaign
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'quality' ? 'active' : ''}`} onClick={() => selectTab('quality', true)}>
                <AlertTriangle size={18} />
                Data Integrity
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'database' ? 'active' : ''}`} onClick={() => selectTab('database', true)}>
                <FileText size={18} />
                Master Database
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => selectTab('templates', true)}>
                <Settings size={18} />
                Message Templates
              </button>
            </li>
          </ul>
        </nav>

        {/* Theme Switcher Toggle */}
        <button className="theme-switch-btn" onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}>
          {theme === 'dark' ? (
            <>
              <Sun size={14} /> Light Theme Option
            </>
          ) : (
            <>
              <Moon size={14} /> Dark Theme Option
            </>
          )}
        </button>

        <div className="sidebar-footer" style={{ marginTop: 12 }}>
          <p>Campaign Ends:</p>
          <p style={{ fontWeight: 600, color: 'var(--color-text-white)', marginTop: 4 }}>Sep 6, 2026 @ 8:00 AM</p>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* Campaign Focus & Countdown Banner */}
        <section className="focus-banner">
          <div className="candidate-focus">
            <div className="candidate-badge">#3</div>
            <div className="candidate-details">
              <h2>Anil Kumar K G Pillai</h2>
              <p>Managing Committee Candidate • 7-Candidate Joint Panel</p>
            </div>
          </div>

          <div className="countdown-container">
            <Clock size={16} color="#10b981" />
            <span className="countdown-label">Time to election:</span>
            <div className="countdown-clock">
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </div>
          </div>
        </section>

        {/* Dashboard Canvas */}
        <div className="content-canvas">
          
          {/* ==================== DASHBOARD TAB ==================== */}
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="tab-title">Outreach & Progress Dashboard</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Daily Email Target Tracker */}
                <div className="glass-panel target-tracker-card" style={{ marginBottom: 0 }}>
                  <div className="target-header">
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-white)' }}>
                      <Mail size={16} color="#6366f1" /> Daily Email Target Progress
                    </span>
                    <span style={{ fontWeight: 700, color: '#818cf8' }}>
                      {emailsSentToday} / {emailTarget} sent ({Math.round(emailProgressPct)}%)
                    </span>
                  </div>
                  <div className="target-progress-bar-container">
                    <div className="target-progress-bar" style={{ width: `${emailProgressPct}%` }}></div>
                    <div className="target-marker" title="Daily Limit"></div>
                  </div>
                  <p style={{ fontSize: 11, color: varColorTextMuted(), marginTop: 6 }}>
                    Target: 2,000 emails per day. Maximize outreach daily to cover the entire master contacts list.
                  </p>
                </div>

                {/* Election Day Progress Bar */}
                <div className="glass-panel target-tracker-card" style={{ marginBottom: 0 }}>
                  <div className="target-header">
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-white)' }}>
                      <Vote size={16} color="#10b981" /> Election Day Panel Progress
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>
                        {securedVotes} /
                      </span>
                      <input 
                        type="number" 
                        value={exitPollTarget}
                        onChange={(e) => setExitPollTarget(Math.max(1, Number(e.target.value)))}
                        style={{ width: '60px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--color-input-text)', borderRadius: '4px', fontSize: '13px', padding: '1px 4px', textAlign: 'center', fontWeight: 'bold' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>
                        votes ({Math.round(exitPollProgressPct)}%)
                      </span>
                    </div>
                  </div>
                  <div className="target-progress-bar-container">
                    <div className="target-progress-bar" style={{ width: `${exitPollProgressPct}%`, background: 'var(--grad-success)' }}></div>
                  </div>
                  <p style={{ fontSize: 11, color: varColorTextMuted(), marginTop: 6 }}>
                    Tracks total voters who declared "Voted for Panel" on exit poll logging (Target: {exitPollTarget} votes).
                  </p>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-header">
                    <span>Total Contacts</span>
                    <div className="stat-icon"><Users size={20} /></div>
                  </div>
                  <div className="stat-value">{stats.totalContacts}</div>
                  <div className="stat-desc">Imported from master list</div>
                </div>

                <div className="stat-card success">
                  <div className="stat-header">
                    <span>Email Campaign</span>
                    <div className="stat-icon"><Mail size={20} /></div>
                  </div>
                  <div className="stat-value">{stats.email.sent}</div>
                  <div className="stat-desc">{stats.email.undelivered} failed • {stats.email.pending} pending</div>
                </div>

                <div className="stat-card warning">
                  <div className="stat-header">
                    <span>Call Center</span>
                    <div className="stat-icon"><Phone size={20} /></div>
                  </div>
                  <div className="stat-value">
                    {stats.totalContacts - stats.call.notCalled}
                  </div>
                  <div className="stat-desc">{stats.call.connected} connected • {stats.call.notCalled} pending</div>
                </div>

                <div className="stat-card danger">
                  <div className="stat-header">
                    <span>WhatsApp outreach</span>
                    <div className="stat-icon"><MessageSquare size={20} /></div>
                  </div>
                  <div className="stat-value">{stats.whatsapp.sent + stats.whatsapp.delivered}</div>
                  <div className="stat-desc">{stats.whatsapp.failed} failed • {stats.whatsapp.pending} pending</div>
                </div>
              </div>

              <div className="tracker-row">
                {/* SVG Progress charts */}
                <div className="glass-panel">
                  <div className="panel-header">
                    <h3 className="panel-title">Outreach Channels Coverage</h3>
                  </div>
                  <div className="chart-container">
                    <div className="chart-bar-wrapper">
                      <div className="chart-bar-track">
                        <div className="chart-bar" style={{ height: `${Math.round((stats.email.sent / stats.totalContacts) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">Email sent ({Math.round((stats.email.sent / stats.totalContacts) * 100)}%)</span>
                    </div>

                    <div className="chart-bar-wrapper">
                      <div className="chart-bar-track">
                        <div className="chart-bar accent" style={{ height: `${Math.round(((stats.whatsapp.sent + stats.whatsapp.delivered) / stats.totalContacts) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">WhatsApp ({Math.round(((stats.whatsapp.sent + stats.whatsapp.delivered) / stats.totalContacts) * 100)}%)</span>
                    </div>

                    <div className="chart-bar-wrapper">
                      <div className="chart-bar-track">
                        <div className="chart-bar success" style={{ height: `${Math.round((stats.call.connected / stats.totalContacts) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">Connected Call ({Math.round((stats.call.connected / stats.totalContacts) * 100)}%)</span>
                    </div>
                  </div>
                </div>

                {/* Pre-election Sentiment Donut Chart */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-header" style={{ marginBottom: 12 }}>
                    <h3 className="panel-title">Pre-Election Voter Sentiment</h3>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexGrow: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                      <svg width="130" height="130" viewBox="0 0 42 42">
                        {/* Empty/Base circle */}
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--border-color)" strokeWidth="5.5" />
                        
                        {/* Segment circles */}
                        {donutSlices.map((slice, index) => slice.percentage > 0 && (
                          <circle 
                            key={slice.key}
                            cx="21" 
                            cy="21" 
                            r="15.91549430918954" 
                            fill="transparent" 
                            stroke={slice.color} 
                            strokeWidth="5.5" 
                            strokeDasharray={slice.strokeDasharray}
                            strokeDashoffset={slice.strokeDashoffset}
                            title={`${slice.label}: ${slice.value}`}
                          />
                        ))}
                      </svg>
                      {/* Center label */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Sentiment</span>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-text-white)' }}>
                          {Math.round(((rReaction.strong + rReaction.leaning) / totalSentimentResponses) * 100)}%
                        </span>
                        <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 600 }}>POSITIVE</span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1, minWidth: '150px' }}>
                      {donutSlices.map(slice => (
                        <div key={slice.key} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', fontSize: '11px', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: slice.color, display: 'inline-block' }}></span>
                            {slice.label.split(' (')[0]}
                          </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-text-white)' }}>
                            {slice.value} ({Math.round(slice.percentage)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.5fr', gap: '20px', marginTop: '4px' }}>
                {/* Data integrity alerts quick link */}
                <div className="glass-panel" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="panel-header" style={{ marginBottom: 16 }}>
                    <h3 className="panel-title" style={{ color: '#fbbf24' }}>
                      <AlertTriangle size={18} /> Urgent Data Integrity Issues
                    </h3>
                    <button className="btn" onClick={() => { setActiveTab('quality'); setQualityFilter('Missing Email'); }}>Fix All</button>
                  </div>
                  <div className="issues-list" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                    <div className="issue-item">
                      <span className="issue-label">Contacts missing Email IDs</span>
                      <span className="issue-count">{stats.missingEmail}</span>
                    </div>
                    <div className="issue-item">
                      <span className="issue-label">Duplicate Email IDs detected</span>
                      <span className="issue-count">{stats.duplicateEmail}</span>
                    </div>
                    <div className="issue-item">
                      <span className="issue-label">Duplicate Mobile Numbers detected</span>
                      <span className="issue-count">{stats.duplicateMobile}</span>
                    </div>
                  </div>
                </div>

                {/* Panel Candidates list card */}
                <div className="glass-panel">
                  <div className="panel-header" style={{ marginBottom: 16 }}>
                    <h3 className="panel-title">Our Unified Panel Slate (14 Candidates)</h3>
                    <button className="btn" onClick={() => setActiveTab('candidates')}>View Photos</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Executive Panel Column */}
                    <div>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                        Executive Officers
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {CAMPAIGN_CANDIDATES.filter(c => c.post !== 'Managing Committee Member').map((cand, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-candidate-card)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 4, background: '#6366f1', display: 'flex', alignItems: 'center', justify: 'center', fontSize: 9, fontWeight: 700, color: 'white', justifyContent: 'center' }}>
                              #{cand.sno}
                            </div>
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cand.name}>{cand.name}</div>
                              <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2px' }}>{cand.post}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Managing Committee Panel Column */}
                    <div>
                      <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                        Managing Committee (7 Panel)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {CAMPAIGN_CANDIDATES.filter(c => c.post === 'Managing Committee Member').map((cand, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: cand.isFocus ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-candidate-card)', border: '1px solid', borderColor: cand.isFocus ? '#10b981' : 'var(--border-color)', borderRadius: 8 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 4, background: cand.isFocus ? '#10b981' : '#a855f7', display: 'flex', alignItems: 'center', justify: 'center', fontSize: 9, fontWeight: 700, color: 'white', justifyContent: 'center' }}>
                              #{cand.sno}
                            </div>
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cand.name}>{cand.name}</div>
                              <div style={{ fontSize: '8px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2px' }}>{cand.post}</div>
                            </div>
                            {cand.isFocus && <span style={{ fontSize: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 3px', borderRadius: 3, fontWeight: 900 }}>FOCUS</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== EXCEL DETAILED ANALYTICS DASHBOARD ==================== */}
          {activeTab === 'excelDashboard' && (
            <div>
              <h2 className="tab-title">Detailed Campaign Analytics (Excel View)</h2>

              {/* Dynamic KPI Overview cards */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Total Register Members</span></div>
                  <div className="stat-value">{stats.totalContacts}</div>
                  <div className="stat-desc">Imported from election roster</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Voters Contacted</span></div>
                  <div className="stat-value">
                    {stats.totalContacts - stats.call.notCalled}
                  </div>
                  <div className="stat-desc">
                    {Math.round(((stats.totalContacts - stats.call.notCalled) / stats.totalContacts) * 100) || 0}% Contact Rate
                  </div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>Confirmed Positive (Support)</span></div>
                  <div className="stat-value">
                    {stats.excelBreakdown ? stats.excelBreakdown.positive : 0}
                  </div>
                  <div className="stat-desc">
                    {Math.round(((stats.excelBreakdown ? stats.excelBreakdown.positive : 0) / (stats.totalContacts - stats.call.notCalled || 1)) * 100) || 0}% Support Confirmations
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Still to Call / Outreach</span></div>
                  <div className="stat-value">{stats.call.notCalled}</div>
                  <div className="stat-desc">Voters remaining in queue</div>
                </div>
              </div>

              {/* Response Breakdown and District breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', marginBottom: '24px' }}>
                
                {/* 1. Call Response Breakdown */}
                <div className="glass-panel">
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <BarChart2 size={16} color="#6366f1" /> Response Breakdown
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'Positive', count: stats.excelBreakdown ? stats.excelBreakdown.positive : 0, color: '#10b981' },
                      { label: 'To Be Followed Up', count: stats.excelBreakdown ? stats.excelBreakdown.followup : 0, color: '#f59e0b' },
                      { label: 'Undecided', count: stats.excelBreakdown ? stats.excelBreakdown.undecided : 0, color: '#a78bfa' },
                      { label: 'Negative', count: stats.excelBreakdown ? stats.excelBreakdown.negative : 0, color: '#ef4444' },
                      { label: 'Unreachable', count: stats.excelBreakdown ? stats.excelBreakdown.unreachable : 0, color: '#94a3b8' },
                      { label: 'Not Contacted', count: stats.excelBreakdown ? stats.excelBreakdown.notContacted : 0, color: '#4b5563' }
                    ].map((item, idx) => {
                      const percentage = Math.round((item.count / (stats.totalContacts || 1)) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-white)', marginBottom: 4 }}>
                            <span>{item.label}</span>
                            <span style={{ fontWeight: 600 }}>{item.count} ({percentage}%)</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percentage}%`, background: item.color, borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. District Breakdown */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: '420px' }}>
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Users size={16} color="#10b981" /> Kerala Home Districts
                  </h3>
                  <div className="table-wrapper" style={{ overflowY: 'auto', flexGrow: 1 }}>
                    <table className="data-table small" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>District</th>
                          <th style={{ textAlign: 'center' }}>Members</th>
                          <th style={{ textAlign: 'center' }}>Contacted</th>
                          <th style={{ textAlign: 'center' }}>Positive</th>
                          <th style={{ textAlign: 'center' }}>% Contacted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.byDistrict || []).map((row, idx) => {
                          const contactRate = Math.round((row.contacted / row.total) * 100) || 0;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 500, color: 'var(--color-text-white)' }}>{row.district}</td>
                              <td style={{ textAlign: 'center' }}>{row.total}</td>
                              <td style={{ textAlign: 'center' }}>{row.contacted}</td>
                              <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 600 }}>{row.positive}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                  <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${contactRate}%`, background: '#3b82f6' }}></div>
                                  </div>
                                  <span>{contactRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Emirate breakdown and Volunteer Performance */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: '20px' }}>
                
                {/* 3. UAE Emirates */}
                <div className="glass-panel" style={{ maxHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Map size={16} color="#3b82f6" /> UAE Emirate Distribution
                  </h3>
                  <div className="table-wrapper" style={{ overflowY: 'auto', flexGrow: 1 }}>
                    <table className="data-table small" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Emirate</th>
                          <th style={{ textAlign: 'center' }}>Members</th>
                          <th style={{ textAlign: 'center' }}>Contacted</th>
                          <th style={{ textAlign: 'center' }}>Positive</th>
                          <th style={{ textAlign: 'center' }}>% Contacted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.byEmirate || []).map((row, idx) => {
                          const contactRate = Math.round((row.contacted / row.total) * 100) || 0;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 500, color: 'var(--color-text-white)' }}>{row.emirate}</td>
                              <td style={{ textAlign: 'center' }}>{row.total}</td>
                              <td style={{ textAlign: 'center' }}>{row.contacted}</td>
                              <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 600 }}>{row.positive}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                  <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${contactRate}%`, background: '#60a5fa' }}></div>
                                  </div>
                                  <span>{contactRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Volunteer Leaderboard */}
                <div className="glass-panel" style={{ maxHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                  <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Award size={16} color="#f59e0b" /> Volunteer Call Tracker
                  </h3>
                  <div className="table-wrapper" style={{ overflowY: 'auto', flexGrow: 1 }}>
                    <table className="data-table small" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Caller</th>
                          <th style={{ textAlign: 'center' }}>Assigned</th>
                          <th style={{ textAlign: 'center' }}>Done</th>
                          <th style={{ textAlign: 'center' }}>Positive</th>
                          <th style={{ textAlign: 'center' }}>Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.byVolunteer || []).map((row, idx) => {
                          const successRate = Math.round((row.positive / (row.done || 1)) * 100) || 0;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: row.assigned_to === 'Unassigned' ? 'var(--color-text-muted)' : '#818cf8' }}>{row.assigned_to}</td>
                              <td style={{ textAlign: 'center' }}>{row.assigned}</td>
                              <td style={{ textAlign: 'center' }}>{row.done}</td>
                              <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 600 }}>{row.positive}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ 
                                  background: successRate >= 70 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                                  color: successRate >= 70 ? '#34d399' : 'var(--color-text-white)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600
                                }}>
                                  {successRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==================== EXIT POLL TAB (NEW) ==================== */}
          {activeTab === 'exitpoll' && (
            <div>
              <h2 className="tab-title">Election Day Exit Poll Tracker</h2>

              {/* Progress Summary Widget */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card success">
                  <div className="stat-header"><span>Secured Votes (Panel)</span></div>
                  <div className="stat-value">{stats.exitPoll.secured}</div>
                  <div className="stat-desc">Declared voted for Panel</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-header"><span>Lost Votes (Opposition)</span></div>
                  <div className="stat-value">{stats.exitPoll.lost}</div>
                  <div className="stat-desc">Declared voted for Opposition</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>Secretive / Unknown</span></div>
                  <div className="stat-value">{stats.exitPoll.votedUnknown}</div>
                  <div className="stat-desc">Voted but kept response secret</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Total Booth Exits Logged</span></div>
                  <div className="stat-value">
                    {stats.exitPoll.secured + stats.exitPoll.lost + stats.exitPoll.votedUnknown}
                  </div>
                  <div className="stat-desc">Out of {stats.totalContacts} total voters</div>
                </div>
              </div>

              {/* Exit poll quick input wrapper */}
              <div className="glass-panel" style={{ padding: '24px 32px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(22, 26, 36, 0.65) 100%)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                  <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-white)' }}>
                    ⚡ Rapid Search Voter (Scan AccCode or Enter Name):
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={24} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                    <input 
                      type="text"
                      className="search-input"
                      placeholder="e.g. L19, George, Kasim..."
                      style={{ padding: '16px 20px 16px 54px', fontSize: '18px', background: 'var(--bg-input)', color: 'var(--color-input-text)', border: '2px solid rgba(99, 102, 241, 0.2)' }}
                      value={exitPollSearch}
                      onChange={(e) => setExitPollSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              {/* Match list */}
              {exitPollSearch.trim() && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
                    Matching Voter Profiles ({exitPollMatches.length} found):
                  </h3>

                  {exitPollMatches.length > 0 ? (
                    exitPollMatches.map(voter => (
                      <div key={voter.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 'bold' }}>SNo</span>
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--color-text-white)' }}>{voter.s_no}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-white)' }}>
                              {voter.account_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 12, marginTop: 2 }}>
                              <span>Code: <strong>{voter.acc_code}</strong></span>
                              <span>Mobile: {voter.mobile_number}</span>
                              {voter.member_reaction && voter.member_reaction !== 'Unknown' && (
                                <span style={{ color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === voter.member_reaction)]?.color }}>
                                  Outreach: {voter.member_reaction.split(' (')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Exit Poll Large Mobile-Friendly Action Buttons */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button 
                            type="button"
                            className="btn" 
                            style={{ 
                              background: voter.exit_poll_status === 'Secured' ? '#10b981' : 'rgba(16, 185, 129, 0.08)',
                              color: voter.exit_poll_status === 'Secured' ? 'white' : '#10b981',
                              borderColor: voter.exit_poll_status === 'Secured' ? 'transparent' : 'rgba(16, 185, 129, 0.3)',
                              padding: '12px 20px',
                              fontSize: '14px',
                              fontWeight: 700,
                              boxShadow: voter.exit_poll_status === 'Secured' ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                            }}
                            onClick={() => updateContact(voter.id, { exit_poll_status: 'Secured' })}
                          >
                            ✓ Voted for Panel
                          </button>
                          
                          <button 
                            type="button"
                            className="btn" 
                            style={{ 
                              background: voter.exit_poll_status === 'Lost' ? '#ef4444' : 'rgba(239, 68, 68, 0.08)',
                              color: voter.exit_poll_status === 'Lost' ? 'white' : '#ef4444',
                              borderColor: voter.exit_poll_status === 'Lost' ? 'transparent' : 'rgba(239, 68, 68, 0.3)',
                              padding: '12px 20px',
                              fontSize: '14px',
                              fontWeight: 700,
                              boxShadow: voter.exit_poll_status === 'Lost' ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none'
                            }}
                            onClick={() => updateContact(voter.id, { exit_poll_status: 'Lost' })}
                          >
                            ✗ Voted Opposition
                          </button>

                          <button 
                            type="button"
                            className="btn" 
                            style={{ 
                              background: voter.exit_poll_status === 'Voted-Unknown' ? '#6b7280' : 'rgba(107, 114, 128, 0.08)',
                              color: voter.exit_poll_status === 'Voted-Unknown' ? 'white' : '#9ca3af',
                              borderColor: voter.exit_poll_status === 'Voted-Unknown' ? 'transparent' : 'rgba(107, 114, 128, 0.3)',
                              padding: '12px 20px',
                              fontSize: '14px',
                              fontWeight: 700,
                              boxShadow: voter.exit_poll_status === 'Voted-Unknown' ? '0 0 15px rgba(107, 114, 128, 0.3)' : 'none'
                            }}
                            onClick={() => updateContact(voter.id, { exit_poll_status: 'Voted-Unknown' })}
                          >
                            ? Voted but Secretive
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      No voters matching "{exitPollSearch}" found in database.
                    </div>
                  )}
                </div>
              )}

              {!exitPollSearch.trim() && (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                  <Vote size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '15px' }}>Ready for Election Day outreach logs.</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>Type a voter's Account Code or Name above to record their exit response.</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== EMAIL CAMPAIGN TAB ==================== */}
          {activeTab === 'email' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <h2 className="tab-title" style={{ marginBottom: 0 }}>Email Campaign Tracker</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => setShowImportModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Upload size={16} /> Import Sent / Bounce Logs
                  </button>
                  <button 
                    className="btn success" 
                    disabled={selectedContactIds.length === 0}
                    onClick={() => handleBulkEmailUpdate('Sent')}
                  >
                    <CheckCircle size={16} /> Mark Selected Sent
                  </button>
                  <button 
                    className="btn danger" 
                    disabled={selectedContactIds.length === 0}
                    onClick={() => handleBulkEmailUpdate('Undelivered')}
                  >
                    <AlertTriangle size={16} /> Mark Selected Failed
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Daily Progress</span></div>
                  <div className="stat-value">{emailsSentToday}</div>
                  <div className="stat-desc">Target: 2,000 sent emails per day</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Total Sent</span></div>
                  <div className="stat-value" style={{ color: '#60a5fa' }}>{stats.email.sent}</div>
                  <div className="stat-desc">Cumulative emails dispatched</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Bounces / Failed</span></div>
                  <div className="stat-value" style={{ color: '#f87171' }}>{stats.email.undelivered}</div>
                  <div className="stat-desc">Emails not delivered</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Pending</span></div>
                  <div className="stat-value" style={{ color: 'var(--color-text-secondary)' }}>{stats.email.pending}</div>
                  <div className="stat-desc">Contacts waiting for email</div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="controls-bar">
                <div className="search-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search name, code, or email..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="filters-wrapper">
                  <select 
                    className="filter-select" 
                    value={emailFilter} 
                    onChange={(e) => { setEmailFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Email Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Undelivered">Undelivered</option>
                  </select>
                  <button 
                    className="btn success" 
                    onClick={() => handleExportCSV(true)}
                    disabled={filteredContacts.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <FileText size={14} /> Export Active List ({filteredContacts.length})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" onChange={toggleSelectAll} checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))} /></th>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Email ID</th>
                      <th>Email Status</th>
                      <th>Sent Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContactSelect(contact.id)} /></td>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td style={{ color: contact.email_id ? 'var(--color-text-primary)' : '#ef4444', fontStyle: contact.email_id ? 'normal' : 'italic' }}>
                            {contact.email_id || 'Missing Email ID'}
                          </td>
                          <td>
                            <span className={`status-badge ${contact.email_status.toLowerCase()}`}>
                              {contact.email_status}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{contact.email_sent_date || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="action-group" style={{ justifyContent: 'flex-end' }}>
                              <button 
                                className="action-btn success" 
                                title="Mark Sent"
                                onClick={() => updateContact(contact.id, { email_status: 'Sent', email_sent_date: getTodayString() })}
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button 
                                className="action-btn" 
                                title="Edit/Log Notes"
                                onClick={() => handleOpenDrawer(contact)}
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found matching the filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="pagination">
                  <span>Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} contacts</span>
                  <div className="pagination-buttons">
                    <button className="btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-primary)' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button className="btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== CALL CENTER TAB ==================== */}
          {activeTab === 'call' && (
            <div>
              <h2 className="tab-title">Call Center Operation Sheet</h2>

              {/* Stats overview */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Calls Made Today</span></div>
                  <div className="stat-value">{stats.call.calledToday}</div>
                  <div className="stat-desc">Outreach calls completed today</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Connected / Support</span></div>
                  <div className="stat-value">{stats.call.connected}</div>
                  <div className="stat-desc">Voters spoke & support confirmed</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>No Connect / Retry</span></div>
                  <div className="stat-value">{(stats.call.busy || 0) + (stats.call.noAnswer || 0) + (stats.call.noResponse || 0) + (stats.call.switchedOff || 0) + (stats.call.reminderRequest || 0)}</div>
                  <div className="stat-desc">Busy, No Ans, Off, No Response, or Reminders</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Uncalled Contacts</span></div>
                  <div className="stat-value">{stats.call.notCalled}</div>
                  <div className="stat-desc">Contacts waiting to be called</div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="controls-bar">
                <div className="search-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search name, code, or phone number..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="filters-wrapper">
                  <select 
                    className="filter-select" 
                    value={callFilter} 
                    onChange={(e) => { setCallFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Call Outcomes</option>
                    <option value="Not Called">Not Called</option>
                    <option value="Connected">Connected (Supported)</option>
                    <option value="Busy">Busy</option>
                    <option value="No Answer">No Answer</option>
                    <option value="No Response">No Response</option>
                    <option value="Out of country">Out of country</option>
                    <option value="Switched off">Switched off</option>
                    <option value="Reminder Request">Reminder Request</option>
                    <option value="Left Message">Left Message</option>
                    <option value="Failed">Failed / Declined</option>
                  </select>
                  <button 
                    className="btn success" 
                    onClick={() => handleExportCSV(true)}
                    disabled={filteredContacts.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <FileText size={14} /> Export Active List ({filteredContacts.length})
                  </button>
                </div>
              </div>

              {/* Table list */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Mobile Number</th>
                      <th>Sentiment</th>
                      <th>Call Status</th>
                      <th>Notes</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td>{contact.mobile_number}</td>
                          <td>
                            {contact.member_reaction && contact.member_reaction !== 'Unknown' ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === contact.member_reaction)]?.color }}>
                                {contact.member_reaction.split(' (')[0]}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${contact.call_status.toLowerCase().replace(' ', '-')}`}>
                              {contact.call_status}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {contact.notes || <span style={{ color: 'var(--color-text-muted)' }}>No notes</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="action-group" style={{ justifyContent: 'flex-end' }}>
                              <a href={`tel:${contact.mobile_number}`} className="action-btn primary" title="Call directly">
                                <Phone size={16} />
                              </a>
                              <button 
                                className="action-btn" 
                                title="Update Call Logs & Status"
                                onClick={() => handleOpenDrawer(contact)}
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="pagination">
                  <span>Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} contacts</span>
                  <div className="pagination-buttons">
                    <button className="btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-primary)' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button className="btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== WHATSAPP CAMPAIGN TAB ==================== */}
          {activeTab === 'whatsapp' && (
            <div>
              <h2 className="tab-title">WhatsApp Click-to-Chat outreach</h2>

              {/* Stats Row */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Sent Today</span></div>
                  <div className="stat-value">{stats.whatsapp.sentToday}</div>
                  <div className="stat-desc">WhatsApp messages sent today</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Confirmed Delivered</span></div>
                  <div className="stat-value" style={{ color: '#34d399' }}>{stats.whatsapp.delivered}</div>
                  <div className="stat-desc">Messages delivered successfully</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-header"><span>Failed / Invalid Phone</span></div>
                  <div className="stat-value" style={{ color: '#f87171' }}>{stats.whatsapp.failed}</div>
                  <div className="stat-desc">Numbers without WhatsApp</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Total Pending</span></div>
                  <div className="stat-value">{stats.whatsapp.pending}</div>
                  <div className="stat-desc">Contacts waiting for WhatsApp outreach</div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="controls-bar">
                <div className="search-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search name, code, or phone..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="filters-wrapper">
                  <select 
                    className="filter-select" 
                    value={whatsappFilter} 
                    onChange={(e) => { setWhatsappFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All WhatsApp Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <button 
                    className="btn success" 
                    onClick={() => handleExportCSV(true)}
                    disabled={filteredContacts.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <FileText size={14} /> Export Active List ({filteredContacts.length})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Mobile Number</th>
                      <th>Sentiment</th>
                      <th>WhatsApp Status</th>
                      <th>Sent Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td>{contact.mobile_number}</td>
                          <td>
                            {contact.member_reaction && contact.member_reaction !== 'Unknown' ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === contact.member_reaction)]?.color }}>
                                {contact.member_reaction.split(' (')[0]}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${contact.whatsapp_status.toLowerCase()}`}>
                              {contact.whatsapp_status}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{contact.whatsapp_sent_date || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn primary" 
                              onClick={() => handleWhatsAppClick(contact)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <MessageSquare size={14} /> Send Message <ExternalLink size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="pagination">
                  <span>Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} contacts</span>
                  <div className="pagination-buttons">
                    <button className="btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-primary)' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button className="btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== DATA INTEGRITY TAB ==================== */}
          {activeTab === 'quality' && (
            <div>
              <h2 className="tab-title">Data Integrity & Cleanup Panel</h2>

              {/* Selector Buttons & Filtered Export */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button className={`btn ${qualityFilter === 'All' ? 'primary' : ''}`} onClick={() => { setQualityFilter('All'); setCurrentPage(1); }}>All Contacts</button>
                  <button className={`btn ${qualityFilter === 'Missing Email' ? 'primary' : ''}`} onClick={() => { setQualityFilter('Missing Email'); setCurrentPage(1); }}>
                    Missing Email ({stats.missingEmail})
                  </button>
                  <button className={`btn ${qualityFilter === 'Duplicate Email' ? 'primary' : ''}`} onClick={() => { setQualityFilter('Duplicate Email'); setCurrentPage(1); }}>
                    Duplicate Emails ({stats.duplicateEmail})
                  </button>
                  <button className={`btn ${qualityFilter === 'Duplicate Mobile' ? 'primary' : ''}`} onClick={() => { setQualityFilter('Duplicate Mobile'); setCurrentPage(1); }}>
                    Duplicate Phones ({stats.duplicateMobile})
                  </button>
                </div>
                
                <button 
                  className="btn success" 
                  onClick={() => handleExportCSV(true)}
                  disabled={filteredContacts.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <FileText size={16} /> Export Active List ({filteredContacts.length})
                </button>
              </div>

              {/* Info panel */}
              <div className="glass-panel" style={{ marginBottom: 24, background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fbbf24' }}>
                  <AlertTriangle size={16} /> Use this tool to clean up duplicate contact numbers and fill in missing emails. Fixing details here immediately resolves anomalies inside the active trackers.
                </p>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Mobile Number</th>
                      <th>Email ID</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td style={{ color: 'var(--color-text-primary)' }}>{contact.mobile_number}</td>
                          <td style={{ color: contact.email_id ? 'var(--color-text-primary)' : '#ef4444', fontStyle: contact.email_id ? 'normal' : 'italic' }}>
                            {contact.email_id || 'Empty Email Address'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn" 
                              onClick={() => handleOpenDrawer(contact)}
                            >
                              <Edit2 size={14} /> Correct Details
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No anomalies found for the active filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="pagination">
                  <span>Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} contacts</span>
                  <div className="pagination-buttons">
                    <button className="btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-primary)' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button className="btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MASTER DATABASE TAB ==================== */}
          {activeTab === 'database' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="tab-title">Master Contacts Database</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn success" onClick={() => setShowAddModal(true)}>
                    <Plus size={16} /> Add Contact
                  </button>
                  <button className="btn" onClick={handleExportCSV}>
                    <FileText size={16} /> Export CSV Report
                  </button>
                </div>
              </div>

              {/* Search controls */}
              <div className="controls-bar">
                <div className="search-wrapper" style={{ maxWidth: '100%' }}>
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by Name, S.No, Account Code, Phone, or Email ID..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>

              {/* Full Contacts Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Mobile Number</th>
                      <th>Email ID</th>
                      <th>Sentiment</th>
                      <th>Email Status</th>
                      <th>Call Status</th>
                      <th>WhatsApp</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td>{contact.mobile_number}</td>
                          <td>{contact.email_id || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>None</span>}</td>
                          <td>
                            {contact.member_reaction && contact.member_reaction !== 'Unknown' ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === contact.member_reaction)]?.color }}>
                                {contact.member_reaction.split(' (')[0]}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td><span className={`status-badge ${contact.email_status.toLowerCase()}`}>{contact.email_status}</span></td>
                          <td><span className={`status-badge ${contact.call_status.toLowerCase().replace(' ', '-')}`}>{contact.call_status}</span></td>
                          <td><span className={`status-badge ${contact.whatsapp_status.toLowerCase()}`}>{contact.whatsapp_status}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="action-btn" 
                              title="Edit Details"
                              onClick={() => handleOpenDrawer(contact)}
                            >
                              <Edit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found matching selection.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="pagination">
                  <span>Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} contacts</span>
                  <div className="pagination-buttons">
                    <button className="btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-primary)' }}>Page {currentPage} of {totalPages || 1}</span>
                    <button className="btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TEMPLATES TAB ==================== */}
          {activeTab === 'templates' && (
            <div>
              <h2 className="tab-title">Outreach Script & Message Templates</h2>
              
              <div className="template-grid">
                {/* WhatsApp template card */}
                <div className="template-card">
                  <h3 className="panel-title" style={{ color: '#10b981' }}>
                    <MessageSquare size={18} /> WhatsApp Message Template
                  </h3>
                  <div className="template-variables">
                    <span className="var-tag">&#123;Name&#125;</span>
                    <span className="var-tag">&#123;AccCode&#125;</span>
                    <span className="var-tag">&#123;SerialNo&#125;</span>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.whatsapp} 
                    onChange={(e) => setTemplates(p => ({ ...p, whatsapp: e.target.value }))}
                    style={{ height: 180 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn primary" onClick={() => alert('WhatsApp template updated locally!')}>
                      <Save size={14} /> Update Template
                    </button>
                  </div>
                </div>

                {/* Email template card */}
                <div className="template-card">
                  <h3 className="panel-title" style={{ color: '#3b82f6' }}>
                    <Mail size={18} /> Email Message Template
                  </h3>
                  <div className="template-variables">
                    <span className="var-tag">&#123;Name&#125;</span>
                    <span className="var-tag">&#123;AccCode&#125;</span>
                    <span className="var-tag">&#123;SerialNo&#125;</span>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.email} 
                    onChange={(e) => setTemplates(p => ({ ...p, email: e.target.value }))}
                    style={{ height: 180 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn primary" onClick={() => alert('Email template updated locally!')}>
                      <Save size={14} /> Update Template
                    </button>
                  </div>
                </div>

                {/* Call center script card */}
                <div className="template-card">
                  <h3 className="panel-title" style={{ color: '#f59e0b' }}>
                    <Phone size={18} /> Call Center Talk Script
                  </h3>
                  <div className="template-variables">
                    <span className="var-tag">&#123;Name&#125;</span>
                    <span className="var-tag">&#123;AccCode&#125;</span>
                    <span className="var-tag">&#123;SerialNo&#125;</span>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.callScript} 
                    onChange={(e) => setTemplates(p => ({ ...p, callScript: e.target.value }))}
                    style={{ height: 180 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn primary" onClick={() => alert('Call script template updated locally!')}>
                      <Save size={14} /> Update Script
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== OUR CANDIDATES TAB ==================== */}
          {activeTab === 'candidates' && (
            <div>
              <h2 className="tab-title">Our Unified Panel Slate (14 Candidates)</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: '13px' }}>
                Full candidate slate for the upcoming Managing Committee Selection on September 6, 2026. Supporting candidate <strong>Anil Kumar K G Pillai (Serial No. 3)</strong> and our joint panel.
              </p>

              {/* Executive Panel Section */}
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-white)', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                Executive Panel (Office Bearers)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {CAMPAIGN_CANDIDATES.filter(c => c.post !== 'Managing Committee Member').map((cand, idx) => (
                  <div key={idx} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '16px', position: 'relative', border: '1px solid var(--border-color)', borderRadius: '12px', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ position: 'absolute', top: 12, left: 12, background: 'var(--grad-primary)', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '11px', fontWeight: 'bold' }}>
                      No. {cand.sno}
                    </div>
                    {/* Photo / Placeholder */}
                    {cand.photo ? (
                      <img 
                        src={cand.photo} 
                        alt={cand.name} 
                        style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', margin: '24px 0 16px 0' }} 
                      />
                    ) : (
                      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0 16px 0', fontSize: '28px', fontWeight: 700, color: 'var(--color-text-white)', position: 'relative' }}>
                        {cand.initials}
                        <span style={{ position: 'absolute', bottom: -6, background: 'rgba(0, 0, 0, 0.75)', color: '#9ca3af', fontSize: '8px', padding: '2px 6px', borderRadius: 10, border: '1px solid var(--border-color)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Photo Pending</span>
                      </div>
                    )}
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-white)', marginBottom: 4, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cand.name}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {cand.post}
                    </span>
                  </div>
                ))}
              </div>

              {/* Managing Committee Members Section */}
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-white)', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                Managing Committee Panel (7 Candidates)
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                {CAMPAIGN_CANDIDATES.filter(c => c.post === 'Managing Committee Member').map((cand, idx) => (
                  <div 
                    key={idx} 
                    className="glass-panel" 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      padding: '16px', 
                      position: 'relative', 
                      border: cand.isFocus ? '2px solid #10b981' : '1px solid var(--border-color)', 
                      borderRadius: '12px', 
                      alignItems: 'center', 
                      textAlign: 'center',
                      boxShadow: cand.isFocus ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
                      background: cand.isFocus ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(22, 26, 36, 0.75) 100%)' : 'var(--bg-card)'
                    }}
                  >
                    <div style={{ position: 'absolute', top: 12, left: 12, background: cand.isFocus ? 'var(--grad-success)' : 'var(--grad-primary)', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '11px', fontWeight: 'bold' }}>
                      No. {cand.sno}
                    </div>
                    {cand.isFocus && (
                      <div style={{ position: 'absolute', top: 12, right: 12, background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ★ Main Focus
                      </div>
                    )}
                    {/* Photo / Placeholder */}
                    {cand.photo ? (
                      <img 
                        src={cand.photo} 
                        alt={cand.name} 
                        style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: cand.isFocus ? '2px solid #10b981' : '2px solid var(--border-color)', margin: '24px 0 16px 0' }} 
                      />
                    ) : (
                      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: cand.isFocus ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(4, 120, 87, 0.2) 100%)' : 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)', border: cand.isFocus ? '2px dashed #10b981' : '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0 16px 0', fontSize: '28px', fontWeight: 700, color: 'var(--color-text-white)', position: 'relative' }}>
                        {cand.initials}
                        <span style={{ position: 'absolute', bottom: -6, background: 'rgba(0, 0, 0, 0.75)', color: '#9ca3af', fontSize: '8px', padding: '2px 6px', borderRadius: 10, border: '1px solid var(--border-color)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Photo Pending</span>
                      </div>
                    )}
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-white)', marginBottom: 4, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cand.name}
                    </h4>
                    <span style={{ fontSize: '11px', color: cand.isFocus ? '#10b981' : '#a855f7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {cand.post}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ==================== CONTACT DETAIL DRAWER ==================== */}
      {isDrawerOpen && selectedContact && (
        <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 className="drawer-title">Outreach Call & log Notes</h3>
              <button className="close-btn" onClick={() => setIsDrawerOpen(false)}>×</button>
            </div>

            <div className="drawer-section">
              <h4 className="drawer-section-title">Contact Profile</h4>
              <div className="grid-2">
                <div className="drawer-field">
                  <span className="drawer-label">S.No</span>
                  <span className="drawer-value">{selectedContact.s_no}</span>
                </div>
                <div className="drawer-field">
                  <span className="drawer-label">AccCode</span>
                  <span className="drawer-value">{selectedContact.acc_code}</span>
                </div>
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Account Name</span>
                <input 
                  type="text" 
                  className="drawer-input" 
                  value={selectedContact.account_name} 
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, account_name: e.target.value }))}
                />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Mobile Number</span>
                <input 
                  type="text" 
                  className="drawer-input" 
                  value={selectedContact.mobile_number} 
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, mobile_number: e.target.value }))}
                />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Email ID</span>
                <input 
                  type="text" 
                  className="drawer-input" 
                  value={selectedContact.email_id} 
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, email_id: e.target.value }))}
                />
              </div>
            </div>

            <div className="drawer-section">
              <h4 className="drawer-section-title">Voter Sentiment (Outreach Response)</h4>
              <div className="drawer-field">
                <span className="drawer-label">Current Sentiment Feedback</span>
                <select 
                  className="drawer-input"
                  value={selectedContact.member_reaction || 'Unknown'}
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, member_reaction: e.target.value }))}
                >
                  <option value="Unknown">Unknown / Uncontacted</option>
                  <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                  <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                  <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                  <option value="Opposed">🔴 Opposed</option>
                </select>
              </div>
            </div>

            <div className="drawer-section">
              <h4 className="drawer-section-title">Call Center Logs</h4>
              
              <div className="drawer-field">
                <span className="drawer-label">Call Status Outcome</span>
                <select 
                  className="drawer-input" 
                  value={selectedContact.call_status}
                  onChange={(e) => setSelectedContact(prev => ({ 
                    ...prev, 
                    call_status: e.target.value,
                    call_sent_date: e.target.value !== 'Not Called' ? getTodayString() : '' 
                  }))}
                >
                  <option value="Not Called">Not Called</option>
                  <option value="Connected">Connected (Confirms Support)</option>
                  <option value="Busy">Busy (Call back later)</option>
                  <option value="No Answer">No Answer</option>
                  <option value="No Response">No Response</option>
                  <option value="Out of country">Out of country</option>
                  <option value="Switched off">Switched off</option>
                  <option value="Reminder Request">Reminder Request</option>
                  <option value="Left Message">Left Message</option>
                  <option value="Failed">Failed / Declined</option>
                </select>
              </div>

              {selectedContact.call_status !== 'Not Called' && (
                <div className="drawer-field">
                  <span className="drawer-label">Call Date</span>
                  <span className="drawer-value">{selectedContact.call_sent_date || getTodayString()}</span>
                </div>
              )}

              <div className="drawer-field">
                <span className="drawer-label">Call Discussion / Notes</span>
                <textarea 
                  className="drawer-textarea" 
                  placeholder="Enter comments on support, response, or scheduling..." 
                  value={selectedContact.notes || ''}
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="drawer-section">
              <h4 className="drawer-section-title">Campaign Channel Statuses</h4>
              <div className="grid-2">
                <div className="drawer-field">
                  <span className="drawer-label">Email Campaign</span>
                  <select 
                    className="drawer-input"
                    value={selectedContact.email_status}
                    onChange={(e) => setSelectedContact(prev => ({ 
                      ...prev, 
                      email_status: e.target.value,
                      email_sent_date: e.target.value === 'Sent' ? getTodayString() : '' 
                    }))}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Undelivered">Undelivered / Bounced</option>
                  </select>
                </div>
                
                <div className="drawer-field">
                  <span className="drawer-label">WhatsApp Campaign</span>
                  <select 
                    className="drawer-input"
                    value={selectedContact.whatsapp_status}
                    onChange={(e) => setSelectedContact(prev => ({ 
                      ...prev, 
                      whatsapp_status: e.target.value,
                      whatsapp_sent_date: e.target.value === 'Sent' || e.target.value === 'Delivered' ? getTodayString() : '' 
                    }))}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Exit Poll on-the-fly override */}
            <div className="drawer-section">
              <h4 className="drawer-section-title">Election Day Exit Poll</h4>
              <div className="drawer-field">
                <span className="drawer-label">Voting Feedback Status</span>
                <select 
                  className="drawer-input"
                  value={selectedContact.exit_poll_status || 'Pending'}
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, exit_poll_status: e.target.value }))}
                >
                  <option value="Pending">Pending / Unknown</option>
                  <option value="Secured">Secured (Voted Panel)</option>
                  <option value="Lost">Lost (Voted Opposition)</option>
                  <option value="Voted-Unknown">Voted but Secretive</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
              <button className="btn primary" style={{ flexGrow: 1 }} onClick={handleSaveDrawerDetails}>
                <Save size={16} /> Save Outreach Logs
              </button>
              <button className="btn" onClick={() => setIsDrawerOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD CONTACT MODAL ==================== */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddContact}>
            <div className="modal-header">
              <h3 className="drawer-title">Add New Campaign Contact</h3>
              <button type="button" className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <div className="drawer-field">
              <span className="drawer-label">Account Name *</span>
              <input 
                type="text" 
                className="drawer-input" 
                placeholder="Enter candidate/voter full name"
                required
                value={newContact.name}
                onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="drawer-field">
              <span className="drawer-label">Account Code</span>
              <input 
                type="text" 
                className="drawer-input" 
                placeholder="e.g. L190"
                value={newContact.accCode}
                onChange={(e) => setNewContact(prev => ({ ...prev, accCode: e.target.value }))}
              />
            </div>

            <div className="drawer-field">
              <span className="drawer-label">Mobile Number *</span>
              <input 
                type="text" 
                className="drawer-input" 
                placeholder="e.g. 971500000000"
                required
                value={newContact.mobile}
                onChange={(e) => setNewContact(prev => ({ ...prev, mobile: e.target.value }))}
              />
            </div>

            <div className="drawer-field">
              <span className="drawer-label">Email ID</span>
              <input 
                type="email" 
                className="drawer-input" 
                placeholder="e.g. voter@example.com"
                value={newContact.email}
                onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="modal-footer">
              <button type="submit" className="btn success">Create Contact</button>
              <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== WHATSAPP CONFIRMATION MODAL ==================== */}
      {waConfirmContact && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare color="#10b981" /> WhatsApp Sent Confirmation
              </h3>
            </div>
            
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              You have been redirected to send a WhatsApp message to <strong>{waConfirmContact.account_name}</strong> ({waConfirmContact.mobile_number}). 
              What was the outcome?
            </p>

            {/* Voter Sentiment Option */}
            <div className="drawer-field" style={{ marginBottom: 16 }}>
              <span className="drawer-label" style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>
                Voter Sentiment (If disclosed during WhatsApp interaction):
              </span>
              <select 
                id="wa-sentiment-select"
                className="drawer-input"
                defaultValue={waConfirmContact.member_reaction || 'Unknown'}
              >
                <option value="Unknown">Unknown / Unspecified</option>
                <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                <option value="Opposed">🔴 Opposed</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn success" onClick={() => {
                const sentiment = document.getElementById('wa-sentiment-select')?.value;
                confirmWhatsAppStatus('Delivered', sentiment);
              }}>
                ✓ Message Delivered / Sent Successfully
              </button>
              <button className="btn" onClick={() => {
                const sentiment = document.getElementById('wa-sentiment-select')?.value;
                confirmWhatsAppStatus('Sent', sentiment);
              }}>
                Message Sent (Not sure of delivery)
              </button>
              <button className="btn danger" onClick={() => {
                confirmWhatsAppStatus('Failed');
              }}>
                ✗ Delivery Failed / Invalid Phone Number
              </button>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
              <button type="button" className="btn" onClick={() => setWaConfirmContact(null)}>Skip Log</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BULK IMPORT MODAL ==================== */}
      {showImportModal && (
        <div className="modal-backdrop" onClick={() => { setShowImportModal(false); setImportAnalysis(null); setImportRawText(''); }}>
          <div className="modal" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={20} color="#6366f1" /> Import Email Campaign Logs
              </h3>
              <button className="close-btn" onClick={() => { setShowImportModal(false); setImportAnalysis(null); setImportRawText(''); }}><X size={20} /></button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: 16 }}>
              <button 
                type="button"
                className="btn" 
                style={{ 
                  background: importTab === 'sent' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid',
                  borderColor: importTab === 'sent' ? 'var(--border-color)' : 'transparent',
                  borderBottomColor: importTab === 'sent' ? 'var(--bg-modal)' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '10px 20px',
                  color: importTab === 'sent' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => { setImportTab('sent'); setImportAnalysis(null); }}
              >
                📥 Import Sent List
              </button>
              <button 
                type="button"
                className="btn" 
                style={{ 
                  background: importTab === 'failed' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid',
                  borderColor: importTab === 'failed' ? 'var(--border-color)' : 'transparent',
                  borderBottomColor: importTab === 'failed' ? 'var(--bg-modal)' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '10px 20px',
                  color: importTab === 'failed' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => { setImportTab('failed'); setImportAnalysis(null); }}
              >
                ⚠️ Import Bounces / Failures
              </button>
            </div>

            {/* Modal Content */}
            {!importAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {importTab === 'sent' ? (
                    "Copy and paste your email sending report (text, CSV, or column copy from Excel). The importer will automatically extract all email addresses and mark those contacts as 'Sent' for today."
                  ) : (
                    "Copy and paste your bounce or failure list from a Google Sheet column or email report. The importer will extract all email addresses and mark them as 'Undelivered'."
                  )}
                </p>
                <textarea 
                  className="drawer-textarea" 
                  placeholder={importTab === 'sent' ? "Example:\nGeorge, george@example.com\nkvshams@gmail.com\nadv.yarahim@gmail.com" : "Example:\nbounce1@example.com\ninvalid-email@gmail.com"}
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  style={{ height: '220px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn primary" onClick={handleAnalyzeImportText}>
                    Analyze Paste Logs
                  </button>
                  <button className="btn" onClick={() => { setShowImportModal(false); setImportRawText(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Analysis Results view
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Result Statistics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stat-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Unique Emails Found</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-white)' }}>{importAnalysis.emailsFoundCount}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Matching Database Contacts</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{importAnalysis.matchedContacts.length}</div>
                  </div>
                </div>

                {/* Match warnings */}
                {importAnalysis.matchedContacts.length === 0 ? (
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 12, borderRadius: 8, fontSize: 13, color: '#f87171', alignItems: 'center' }}>
                    <AlertCircle size={16} /> No matching email addresses found in your database. Double check the pasted values.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 12, borderRadius: 8, fontSize: 13, color: '#34d399', alignItems: 'center' }}>
                    <CheckCircle size={16} /> Found {importAnalysis.matchedContacts.length} matching voter record(s). Ready to update their status.
                  </div>
                )}

                {/* Unmatched list preview */}
                {importAnalysis.unmatchedEmails.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Unmatched Emails ({importAnalysis.unmatchedEmails.length} found in text but not in database):</h4>
                    <div style={{ maxHeight: '80px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#f87171' }}>
                      {importAnalysis.unmatchedEmails.join(', ')}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button 
                    className="btn success" 
                    disabled={importAnalysis.matchedContacts.length === 0}
                    onClick={handleExecuteImport}
                  >
                    ✓ Apply Updates to Database
                  </button>
                  <button className="btn" onClick={() => setImportAnalysis(null)}>
                    ← Back to Paste
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function varColorTextMuted() {
  return 'var(--color-text-muted)';
}
