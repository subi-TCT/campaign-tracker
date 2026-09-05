import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Mail, Phone, MessageSquare, AlertTriangle, Search, 
  ChevronLeft, ChevronRight, CheckCircle, Clock, Edit2, 
  Plus, FileText, Settings, HelpCircle, Save, ExternalLink,
  Sun, Moon, Upload, AlertCircle, X, Vote, Award, BarChart2, Menu,
  Smartphone, Send, Inbox, RefreshCw, Database, Download, MapPin, Copy,
  Image as ImageIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

// Campaign Emojis for quick insertion
const CAMPAIGN_EMOJIS = ['🟢', '🗳️', '🙏', '🤝', '👤', '✨', '📢', '✅', '⭐', '🇮🇳', '⚖️', '🟡', '🔴', '📱', '✌️', '🎉'];

// Default message templates with preserved Unicode emojis
const DEFAULT_TEMPLATES = {
  whatsapp: "Dear {Name},\n\nKindly support 🟢 *Anil Kumar K G Pillai* (Managing Committee Candidate - Serial No. 3) & our 7-candidate panel 🗳️ for the Managing Committee Selection on Sep 6th, 2026 (8 AM onwards). Your valuable vote is critical for our success. 🙏\n\nThank you,\nCampaign Team",
  email: "Dear {Name},\n\nWe hope this email finds you well.\n\nWe kindly request your valuable vote and support for Anil Kumar K G Pillai (Managing Committee Candidate, Serial No. 3) and our 7-candidate panel in the upcoming Managing Committee Selection on Sunday, September 6, 2026.\n\nYour support will ensure strong leadership and progress.\n\nBest regards,\nCampaign Committee",
  callScript: "Hello {Name}, calling from the election committee. We request your support for Managing Committee candidate Anil Kumar K G Pillai (Serial No. 3) and our 7-candidate panel in the selection on September 6th at 8:00 AM. May we count on your support?",
  sms: "Dear {Name}, please support Anil Kumar K G Pillai (Serial No. 3) & our 7-candidate panel for Managing Committee Selection on Sep 6th. Your vote is vital. Thank you!"
};

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
  const [smsFilter, setSmsFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [sentimentFilter, setSentimentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');

  // Textbee SMS Gateway states
  const [textbeeConfig, setTextbeeConfig] = useState({ isConfigured: false, hasDeviceId: false });
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsBroadcastProgress, setSmsBroadcastProgress] = useState(null);
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [incomingSmsList, setIncomingSmsList] = useState([]);
  const [showSmsInboxModal, setShowSmsInboxModal] = useState(false);

  // Volunteer management states
  const [volunteers, setVolunteers] = useState([]);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [newVolunteerName, setNewVolunteerName] = useState('');
  const [selectedVolunteerDetail, setSelectedVolunteerDetail] = useState(null);
  const [districtFilter, setDistrictFilter] = useState('All');
  const [assignedToFilter, setAssignedToFilter] = useState('All');

  // Selection for bulk actions
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  
  // Drawer / Modal states
  const [selectedContact, setSelectedContact] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', accCode: '', mobile: '', email: '', district: '', area: '' });
  const [waConfirmContact, setWaConfirmContact] = useState(null); // Contact currently sending WA to

  // Bulk Import Logs modal states (Email)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState('sent'); // 'sent' or 'failed'
  const [importRawText, setImportRawText] = useState('');
  const [importAnalysis, setImportAnalysis] = useState(null);

  // Bulk WhatsApp Numbers Import modal states
  const [showWaImportModal, setShowWaImportModal] = useState(false);
  const [waImportTab, setWaImportTab] = useState('sent'); // 'sent' or 'failed'
  const [waImportRawText, setWaImportRawText] = useState('');
  const [waImportAnalysis, setWaImportAnalysis] = useState(null);
  const [waImportStatus, setWaImportStatus] = useState('Sent');
  const [waImportDate, setWaImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [waImportSentiment, setWaImportSentiment] = useState('');
  const [waSelectedMatchIds, setWaSelectedMatchIds] = useState([]);
  const [waImportError, setWaImportError] = useState('');
  const [isAnalyzingWa, setIsAnalyzingWa] = useState(false);

  // Bulk Import & Update Master Contacts Modal states
  const [showMasterImportModal, setShowMasterImportModal] = useState(false);
  const [masterImportTab, setMasterImportTab] = useState('file'); // 'file' or 'paste'
  const [masterImportRawText, setMasterImportRawText] = useState('');
  const [masterImportFileName, setMasterImportFileName] = useState('');
  const [masterImportAnalysis, setMasterImportAnalysis] = useState(null);
  const [masterInsertNew, setMasterInsertNew] = useState(true);
  const [masterSelectedAccCodes, setMasterSelectedAccCodes] = useState([]);
  const [masterImportError, setMasterImportError] = useState('');
  const [isAnalyzingMaster, setIsAnalyzingMaster] = useState(false);
  const [isExecutingMaster, setIsExecutingMaster] = useState(false);

  // Exit poll win threshold
  const [exitPollTarget, setExitPollTarget] = useState(
    Number(localStorage.getItem('exit_poll_target')) || 1000
  );

  // Templates state (persisted to localStorage with Unicode emoji support)
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('campaign_templates');
      if (saved) {
        return { ...DEFAULT_TEMPLATES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading saved templates:', e);
    }
    return DEFAULT_TEMPLATES;
  });

  // Persist templates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('campaign_templates', JSON.stringify(templates));
    } catch (e) {
      console.warn('Error saving templates:', e);
    }
  }, [templates]);

  // WhatsApp helper states
  const [copiedContactId, setCopiedContactId] = useState(null);
  const [waSendMode, setWaSendMode] = useState(() => localStorage.getItem('wa_send_mode') || 'web');
  const [isWaComposerOpen, setIsWaComposerOpen] = useState(false);

  // Template Photo state for campaign posters/candidate photos
  const [templatePhoto, setTemplatePhoto] = useState(() => {
    try {
      return localStorage.getItem('campaign_template_photo') || '/candidates/anil.jpg';
    } catch (e) {
      return '/candidates/anil.jpg';
    }
  });
  const [customFlyerName, setCustomFlyerName] = useState(() => {
    try {
      return localStorage.getItem('campaign_custom_flyer_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [customFlyerData, setCustomFlyerData] = useState(() => {
    try {
      const saved = localStorage.getItem('campaign_custom_flyer_data');
      if (saved) return saved;
      const photo = localStorage.getItem('campaign_template_photo');
      if (photo && photo.startsWith('data:')) return photo;
      return '';
    } catch (e) {
      return '';
    }
  });
  const [isPhotoEnabled, setIsPhotoEnabled] = useState(() => {
    try {
      return localStorage.getItem('campaign_photo_enabled') !== 'false';
    } catch (e) {
      return true;
    }
  });
  const [showBulkPhotoGuide, setShowBulkPhotoGuide] = useState(false);
  const waFlyerInputRef = useRef(null);
  const tplFlyerInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('wa_send_mode', waSendMode);
  }, [waSendMode]);

  useEffect(() => {
    try {
      localStorage.setItem('campaign_template_photo', templatePhoto);
      localStorage.setItem('campaign_custom_flyer_name', customFlyerName);
      if (customFlyerData) {
        localStorage.setItem('campaign_custom_flyer_data', customFlyerData);
      }
      localStorage.setItem('campaign_photo_enabled', String(isPhotoEnabled));
    } catch (e) {
      console.warn('Error saving template photo settings:', e);
    }
  }, [templatePhoto, customFlyerName, customFlyerData, isPhotoEnabled]);

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

      // Query Textbee configuration status
      fetch(`${API_BASE}/sms/config`)
        .then(r => r.ok ? r.json() : null)
        .then(cfg => { if (cfg) setTextbeeConfig(cfg); })
        .catch(() => {});

      // Query incoming SMS messages
      fetchIncomingSms();
    } catch (err) {
      console.error(err);
      setError('Could not connect to the local backend. Please ensure the backend server is running on http://localhost:3001.');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingSms = async () => {
    try {
      const res = await fetch(`${API_BASE}/sms/inbox?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setIncomingSmsList(data || []);
      }
    } catch (err) {
      console.error('Error fetching incoming SMS inbox:', err);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const res = await fetch(`${API_BASE}/volunteers`);
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data);
      }
    } catch (err) {
      console.error('Error fetching volunteers list:', err);
    }
  };

  const handleAddVolunteer = async () => {
    if (!newVolunteerName || !newVolunteerName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVolunteerName.trim() })
      });
      if (res.ok) {
        setNewVolunteerName('');
        await fetchVolunteers();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to add volunteer');
      }
    } catch (err) {
      console.error(err);
      alert('Error adding volunteer');
    }
  };

  const handleDeleteVolunteer = async (name) => {
    if (!window.confirm(`Are you sure you want to delete volunteer "${name}"? This will reset all their assigned contacts to Unassigned.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/volunteers/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchVolunteers();
        await fetchData(); // Refresh contacts to show Unassigned changes
      } else {
        alert('Failed to delete volunteer');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting volunteer');
    }
  };

  const handleBulkAssignVolunteers = async (volunteerName) => {
    if (selectedContactIds.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/contacts/bulk-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedContactIds,
          assigned_to: volunteerName
        })
      });
      if (res.ok) {
        setSelectedContactIds([]);
        await fetchData();
        alert(`Successfully assigned ${selectedContactIds.length} contacts to ${volunteerName}!`);
      } else {
        alert('Failed to assign contacts.');
      }
    } catch (err) {
      console.error(err);
      alert('Error assigning contacts.');
    }
  };

  useEffect(() => {
    fetchData();
    fetchVolunteers();
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
    setSelectedVolunteerDetail(null);
    setSelectedContactIds([]);
    if (searchReset) {
      setCurrentPage(1);
      setSearchQuery('');
      setSentimentFilter('All');
      setStatusFilter('Active');
      setDistrictFilter('All');
      setAssignedToFilter('All');
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

  // Bulk update call status
  const handleBulkCallUpdate = async (status, idsToUpdate = null) => {
    const ids = idsToUpdate || selectedContactIds;
    if (ids.length === 0) return;
    try {
      const today = getTodayString();
      const res = await fetch(`${API_BASE}/contacts/bulk-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          status,
          date: today
        })
      });
      if (!res.ok) throw new Error('Bulk call update failed');
      
      // Clear selection & reload everything
      if (!idsToUpdate) setSelectedContactIds([]);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk call update failed.');
    }
  };

  // Bulk update whatsapp status
  const handleBulkWhatsAppUpdate = async (status, idsToUpdate = null, customDate = null, sentiment = null) => {
    const ids = idsToUpdate || selectedContactIds;
    if (ids.length === 0) return;
    try {
      const today = customDate || getTodayString();
      const payload = {
        ids,
        status,
        date: today
      };
      if (sentiment && sentiment.trim() && sentiment !== 'Keep Current') {
        payload.sentiment = sentiment;
      }
      const res = await fetch(`${API_BASE}/contacts/bulk-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Bulk WhatsApp update failed');
      
      // Clear selection & reload everything
      if (!idsToUpdate) setSelectedContactIds([]);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk WhatsApp update failed.');
    }
  };

  // Bulk update voter sentiment
  const handleBulkSentimentUpdate = async (sentiment, idsToUpdate = null) => {
    const ids = idsToUpdate || selectedContactIds;
    if (ids.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/contacts/bulk-sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          sentiment
        })
      });
      if (!res.ok) throw new Error('Bulk sentiment update failed');
      
      // Clear selection & reload everything
      if (!idsToUpdate) setSelectedContactIds([]);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk sentiment update failed.');
    }
  };

  // Bulk update SMS status manually
  const handleBulkSmsUpdate = async (status, idsToUpdate = null) => {
    const ids = idsToUpdate || selectedContactIds;
    if (ids.length === 0) return;
    try {
      const today = getTodayString();
      const res = await fetch(`${API_BASE}/contacts/bulk-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          status,
          date: status === 'Sent' ? today : ''
        })
      });
      if (!res.ok) throw new Error('Bulk SMS update failed');
      
      if (!idsToUpdate) setSelectedContactIds([]);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk SMS status update failed.');
    }
  };

  // Send single SMS via Textbee
  const handleSendSingleSms = async (contact) => {
    if (!contact.mobile_number) {
      alert('This contact has no mobile number recorded.');
      return;
    }
    if (!window.confirm(`Send SMS to ${contact.account_name} (${contact.mobile_number}) via connected Android phone?`)) {
      return;
    }
    setIsSendingSms(true);
    try {
      const res = await fetch(`${API_BASE}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contact.id,
          message: templates.sms
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send SMS.');
      } else {
        await fetchData();
        alert(`SMS dispatched successfully to ${contact.account_name}!`);
      }
    } catch (err) {
      console.error(err);
      alert('Network or server error while sending SMS.');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Send test SMS to arbitrary number
  const handleSendTestSms = async () => {
    if (!testSmsPhone || !testSmsPhone.trim()) {
      alert('Please enter a mobile number with country code (e.g., +971501234567) to send a test SMS.');
      return;
    }
    setIsSendingSms(true);
    try {
      const res = await fetch(`${API_BASE}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber: testSmsPhone.trim(),
          message: templates.sms
            .replace(/{Name}/g, 'Voter')
            .replace(/{AccCode}/g, 'L001')
            .replace(/{SerialNo}/g, '3')
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send test SMS. Make sure TEXTBEE_API_KEY is set in backend .env');
      } else {
        alert(`Test SMS successfully sent to ${testSmsPhone}! Please check your recipient phone.`);
      }
    } catch (err) {
      console.error(err);
      alert('Network or server error sending test SMS.');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Broadcast SMS to selected or all filtered contacts with carrier pacing
  const handleBroadcastSms = async (targetIds) => {
    const idsToSend = targetIds || selectedContactIds;
    if (idsToSend.length === 0) {
      alert('No contacts selected for SMS broadcast.');
      return;
    }

    if (!window.confirm(`Broadcast SMS to ${idsToSend.length} voter(s) via your connected Android phone?\n\n• Each SMS will be personalized with the voter's name.\n• A 2-second carrier pacing delay is applied between messages to prevent SIM blocking.`)) {
      return;
    }

    setIsSendingSms(true);
    setSmsBroadcastProgress({
      active: true,
      current: 0,
      total: idsToSend.length,
      sent: 0,
      failed: 0
    });

    try {
      const res = await fetch(`${API_BASE}/sms/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: idsToSend,
          messageTemplate: templates.sms,
          delayMs: 2000
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error during SMS broadcast.');
      } else {
        alert(`Broadcast Finished!\n• Successfully Sent: ${data.sentCount}\n• Failed/Skipped: ${data.failedCount}\n• Total Processed: ${data.total}`);
        setSelectedContactIds([]);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      alert('Error during SMS broadcast process.');
    } finally {
      setIsSendingSms(false);
      setSmsBroadcastProgress(null);
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

  // Helper to normalize phone numbers for UAE & international matching
  const normalizePhoneNumber = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00971')) digits = '971' + digits.slice(5);
    else if (digits.startsWith('05') && digits.length === 10) digits = '971' + digits.slice(1);
    else if (digits.startsWith('5') && digits.length === 9) digits = '971' + digits;
    return digits;
  };

  // Helper to parse pasted bulk WhatsApp text
  const parsePastedWhatsAppText = (text) => {
    if (!text) return [];
    const lines = text.split(/[\r\n]+/);
    const items = [];

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      let detectedStatus = null;
      if (lower.includes('delivered') || lower.includes('success')) detectedStatus = 'Delivered';
      else if (lower.includes('failed') || lower.includes('invalid') || lower.includes('error') || lower.includes('undelivered') || lower.includes('not on whatsapp')) detectedStatus = 'Failed';
      else if (lower.includes('sent')) detectedStatus = 'Sent';
      else if (lower.includes('pending')) detectedStatus = 'Pending';

      // 1. First, search for formatted phone numbers (e.g. +971 50 646 4369, +971-50-646-7801, 050-646-4369, 050 646 4369)
      const spacedPhoneRegex = /(?:\+|00)?971[\s-]\d{1,2}[\s-]\d{3,4}[\s-]\d{3,4}|(?:\+|00)?971[\s-]\d{2}[\s-]\d{6,7}|05\d[\s-]\d{3}[\s-]\d{4}/g;
      const formattedMatches = line.match(spacedPhoneRegex) || [];
      for (const fm of formattedMatches) {
        const clean = fm.replace(/\D/g, '');
        if (clean.length >= 9 && clean.length <= 15) {
          items.push({
            raw: fm.trim(),
            normalized: normalizePhoneNumber(clean),
            last9: clean.slice(-9),
            detectedStatus
          });
        }
        line = line.replace(fm, ' ');
      }

      // 2. Tokenize remaining line by spaces, commas, semicolons, tabs, pipes, brackets, colons
      const tokens = line.split(/[\s,;\t|\[\](){}\"\'<>]+/);
      for (const token of tokens) {
        // Ignore obvious time tokens like 10:30:15
        if (token.includes(':') && token.length <= 10) continue;
        const clean = token.replace(/\D/g, '');
        if (clean.length >= 9 && clean.length <= 15) {
          items.push({
            raw: token.trim(),
            normalized: normalizePhoneNumber(clean),
            last9: clean.slice(-9),
            detectedStatus
          });
        }
      }
    }

    // Deduplicate by normalized number while preserving status if detected
    const uniqueMap = {};
    for (const item of items) {
      if (!uniqueMap[item.normalized] || (item.detectedStatus && !uniqueMap[item.normalized].detectedStatus)) {
        uniqueMap[item.normalized] = item;
      }
    }
    return Object.values(uniqueMap);
  };

  // Analyze Copy-Pasted WhatsApp Numbers List
  const handleAnalyzeWaImport = () => {
    setWaImportError('');
    if (!waImportRawText || !waImportRawText.trim()) {
      setWaImportError('Please paste phone numbers or campaign logs into the box above.');
      return;
    }

    setIsAnalyzingWa(true);
    try {
      const parsedItems = parsePastedWhatsAppText(waImportRawText);

      if (parsedItems.length === 0) {
        setWaImportError('No valid phone numbers found in the pasted text. Please paste valid numbers (e.g. 050..., +971 50..., 97150...).');
        setIsAnalyzingWa(false);
        return;
      }

      const matchedContacts = [];
      const matchedContactIds = {};
      const unmatchedNumbers = [];

      // Pre-index contacts by normalized numbers & last 9 digits for rapid matching
      const contactList = Array.isArray(contacts) ? contacts : [];
      const contactIndex = contactList.map(c => {
        const norm = normalizePhoneNumber(c.mobile_number);
        return {
          contact: c,
          normalized: norm,
          last9: norm.length >= 9 ? norm.slice(-9) : norm,
          accCode: (c.acc_code || '').toUpperCase().trim()
        };
      });

      parsedItems.forEach(item => {
        let found = false;
        for (const entry of contactIndex) {
          const isMatch = (entry.normalized && entry.normalized === item.normalized) ||
                          (item.last9 && entry.last9 && entry.last9 === item.last9);
          if (isMatch) {
            found = true;
            if (!matchedContactIds[entry.contact.id]) {
              matchedContactIds[entry.contact.id] = true;
              matchedContacts.push({
                ...entry.contact,
                detectedStatus: item.detectedStatus
              });
            }
          }
        }

        if (!found) {
          unmatchedNumbers.push(item.raw || item.normalized);
        }
      });

      const targetStatus = waImportStatus || (waImportTab === 'sent' ? 'Sent' : 'Failed');
      const alreadyStatusCount = matchedContacts.filter(c => c.whatsapp_status === targetStatus).length;
      const toUpdateCount = matchedContacts.length - alreadyStatusCount;

      setWaImportAnalysis({
        numbersParsedCount: parsedItems.length,
        matchedContacts,
        unmatchedNumbers,
        alreadyStatusCount,
        toUpdateCount
      });
      setWaSelectedMatchIds(matchedContacts.map(c => c.id));
    } catch (err) {
      console.error('Error during WhatsApp import analysis:', err);
      setWaImportError('Error parsing numbers: ' + err.message);
    } finally {
      setIsAnalyzingWa(false);
    }
  };

  // Execute Bulk WhatsApp Import Update
  const handleExecuteWaImport = async () => {
    if (!waImportAnalysis || waSelectedMatchIds.length === 0) {
      alert('No contacts selected for update.');
      return;
    }

    const targetStatus = waImportStatus || (waImportTab === 'sent' ? 'Sent' : 'Failed');
    const dateToUse = waImportDate || getTodayString();
    const sentimentToUse = waImportSentiment || null;

    await handleBulkWhatsAppUpdate(targetStatus, waSelectedMatchIds, dateToUse, sentimentToUse);

    alert(`Successfully updated WhatsApp status to '${targetStatus}' for ${waSelectedMatchIds.length} contact(s).`);
    setShowWaImportModal(false);
    setWaImportRawText('');
    setWaImportAnalysis(null);
    setWaSelectedMatchIds([]);
    setWaImportError('');
  };

  // Download Master Contacts Template (.xlsx or .csv)
  const handleDownloadMasterTemplate = (format = 'xlsx') => {
    const headers = [
      'AccCode',
      'AccountName',
      'Mobile Number',
      'Email ID',
      'District',
      'Area',
      'Emirate',
      'Assigned To',
      'Voter Sentiment',
      'Notes',
      'Account Status',
      'S.No'
    ];

    const sampleRows = [
      [
        'L190',
        'Muhammed Rashid',
        '971501234567',
        'rashid@example.com',
        'KOZHIKODE',
        'CITY',
        'Dubai',
        'Anil Kumar',
        'Strong Support (Panel)',
        'Verified membership & support',
        'Active',
        101
      ],
      [
        'L191',
        'Priya Nair',
        '0509876543',
        'priya@example.com',
        'ERNAKULAM',
        'ALUVA',
        'Sharjah',
        'Unassigned',
        'Undecided / Needs Follow-up',
        'Requested election manifesto',
        'Active',
        102
      ],
      [
        'L192',
        'Abdul Kareem',
        '+971 50 555 1234',
        '',
        'MALAPPURAM',
        'MANJERI',
        'Abu Dhabi',
        'Unassigned',
        'Unknown',
        'Fill only available columns',
        'Active',
        103
      ]
    ];

    if (format === 'csv') {
      const allRows = [headers, ...sampleRows];
      const csvContent = "data:text/csv;charset=utf-8," 
        + allRows.map(r => r.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "IAS_Master_Contacts_Template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // XLSX format
      const wsData = [headers, ...sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // AccCode
        { wch: 25 }, // AccountName
        { wch: 18 }, // Mobile Number
        { wch: 25 }, // Email ID
        { wch: 18 }, // District
        { wch: 16 }, // Area
        { wch: 14 }, // Emirate
        { wch: 16 }, // Assigned To
        { wch: 26 }, // Voter Sentiment
        { wch: 30 }, // Notes
        { wch: 14 }, // Account Status
        { wch: 8 }   // S.No
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contacts_Template");
      XLSX.writeFile(wb, "IAS_Master_Contacts_Template.xlsx");
    }
  };

  // Helper to normalize imported row keys to standard contact fields
  const normalizeRowKeys = (row) => {
    const normalized = {};
    for (const rawKey of Object.keys(row)) {
      const cleanKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      const val = row[rawKey];
      if (val === undefined || val === null) continue;
      const strVal = String(val).trim();
      if (!strVal) continue;

      if (cleanKey === 'acccode' || cleanKey === 'accountcode' || cleanKey === 'memberno' || cleanKey === 'membershipno') {
        normalized.acc_code = strVal.replace(/\.0$/, '');
      } else if (cleanKey === 'accountname' || cleanKey === 'name' || cleanKey === 'votername' || cleanKey === 'fullname') {
        normalized.account_name = strVal;
      } else if (cleanKey === 'mobilenumber' || cleanKey === 'mobile' || cleanKey === 'phone' || cleanKey === 'phonenumber' || cleanKey === 'contactnumber') {
        normalized.mobile_number = strVal;
      } else if (cleanKey === 'emailid' || cleanKey === 'email' || cleanKey === 'emailaddress') {
        normalized.email_id = strVal;
      } else if (cleanKey === 'district') {
        normalized.district = strVal;
      } else if (cleanKey === 'area') {
        normalized.area = strVal;
      } else if (cleanKey === 'emirate') {
        normalized.emirate = strVal;
      } else if (cleanKey === 'assignedto' || cleanKey === 'volunteer' || cleanKey === 'assigned') {
        normalized.assigned_to = strVal;
      } else if (cleanKey === 'votersentiment' || cleanKey === 'sentiment' || cleanKey === 'memberreaction' || cleanKey === 'reaction') {
        normalized.member_reaction = strVal;
      } else if (cleanKey === 'notes' || cleanKey === 'note') {
        normalized.notes = strVal;
      } else if (cleanKey === 'accountstatus' || cleanKey === 'status') {
        normalized.account_status = strVal;
      } else if (cleanKey === 'sno' || cleanKey === 'slno' || cleanKey === 'serialno') {
        normalized.s_no = parseInt(strVal, 10) || undefined;
      }
    }
    return normalized;
  };

  // Run matching and change detection for master contact rows
  const runMasterAnalysis = (rawRows) => {
    setIsAnalyzingMaster(true);
    setMasterImportError('');

    try {
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        setMasterImportError('File or pasted data contains no records.');
        setIsAnalyzingMaster(false);
        return;
      }

      // Pre-index existing contacts by uppercase acc_code
      const existingMap = {};
      (contacts || []).forEach(c => {
        if (c.acc_code) {
          existingMap[String(c.acc_code).trim().toUpperCase()] = c;
        }
      });

      const matchedRows = [];
      const newRows = [];
      const skippedRows = [];

      for (let i = 0; i < rawRows.length; i++) {
        const normalized = normalizeRowKeys(rawRows[i]);
        if (!normalized.acc_code) {
          skippedRows.push({ rowNumber: i + 1, reason: 'Missing AccCode', raw: rawRows[i] });
          continue;
        }

        const cleanAccCode = normalized.acc_code.toUpperCase();
        const existing = existingMap[cleanAccCode];

        if (existing) {
          // Detect changes
          const changes = [];
          
          if (normalized.account_name && normalized.account_name !== existing.account_name) {
            changes.push({ field: 'Name', oldVal: existing.account_name || '(empty)', newVal: normalized.account_name });
          }
          if (normalized.mobile_number) {
            const cleanNormMob = normalizePhoneNumber(normalized.mobile_number);
            const cleanExistMob = normalizePhoneNumber(existing.mobile_number);
            if (cleanNormMob && cleanNormMob !== cleanExistMob) {
              changes.push({ field: 'Mobile', oldVal: existing.mobile_number || '(empty)', newVal: normalized.mobile_number });
            }
          }
          if (normalized.email_id && normalized.email_id.toLowerCase() !== (existing.email_id || '').toLowerCase()) {
            changes.push({ field: 'Email', oldVal: existing.email_id || '(empty)', newVal: normalized.email_id });
          }
          if (normalized.district && normalized.district !== existing.district) {
            changes.push({ field: 'District', oldVal: existing.district || '(empty)', newVal: normalized.district });
          }
          if (normalized.area && normalized.area !== existing.area) {
            changes.push({ field: 'Area', oldVal: existing.area || '(empty)', newVal: normalized.area });
          }
          if (normalized.emirate && normalized.emirate !== existing.emirate) {
            changes.push({ field: 'Emirate', oldVal: existing.emirate || '(empty)', newVal: normalized.emirate });
          }
          if (normalized.assigned_to && normalized.assigned_to !== existing.assigned_to) {
            changes.push({ field: 'Volunteer', oldVal: existing.assigned_to || 'Unassigned', newVal: normalized.assigned_to });
          }
          if (normalized.member_reaction && normalized.member_reaction !== existing.member_reaction) {
            changes.push({ field: 'Sentiment', oldVal: existing.member_reaction || 'Unknown', newVal: normalized.member_reaction });
          }
          if (normalized.notes && normalized.notes !== existing.notes) {
            changes.push({ field: 'Notes', oldVal: existing.notes || '(empty)', newVal: normalized.notes });
          }
          if (normalized.account_status && normalized.account_status !== existing.account_status) {
            changes.push({ field: 'Status', oldVal: existing.account_status || 'Active', newVal: normalized.account_status });
          }
          if (normalized.s_no && normalized.s_no !== existing.s_no) {
            changes.push({ field: 'S.No', oldVal: existing.s_no || 0, newVal: normalized.s_no });
          }

          matchedRows.push({
            accCode: normalized.acc_code,
            name: normalized.account_name || existing.account_name || 'Unnamed',
            existingContact: existing,
            normalized,
            changes,
            isNew: false
          });
        } else {
          // New contact
          newRows.push({
            accCode: normalized.acc_code,
            name: normalized.account_name || 'New Contact',
            normalized,
            changes: [{ field: 'New Contact', oldVal: '-', newVal: 'Full Insert' }],
            isNew: true
          });
        }
      }

      if (matchedRows.length === 0 && newRows.length === 0) {
        setMasterImportError('No valid contacts found. Please ensure your file has an "AccCode" column.');
        setIsAnalyzingMaster(false);
        return;
      }

      const allActionable = [...matchedRows, ...newRows];

      setMasterImportAnalysis({
        totalRawCount: rawRows.length,
        matchedRows,
        newRows,
        skippedRows,
        allActionable,
        hasChangesCount: matchedRows.filter(m => m.changes.length > 0).length,
        unchangedCount: matchedRows.filter(m => m.changes.length === 0).length
      });

      // Default select all actionable contacts
      setMasterSelectedAccCodes(allActionable.map(r => r.accCode));
    } catch (err) {
      console.error('Error running master analysis:', err);
      setMasterImportError('Analysis failed: ' + err.message);
    } finally {
      setIsAnalyzingMaster(false);
    }
  };

  // Handle spreadsheet file upload (.xlsx, .xls, .csv, .txt)
  const handleMasterFileSelect = (file) => {
    if (!file) return;
    setMasterImportFileName(file.name);
    setMasterImportError('');
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          runMasterAnalysis(json);
        } catch (err) {
          console.error('Error reading Excel file:', err);
          setMasterImportError('Failed to read Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const workbook = XLSX.read(text, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          runMasterAnalysis(json);
        } catch (err) {
          console.error('Error reading CSV text:', err);
          setMasterImportError('Failed to parse CSV file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle pasted table analysis
  const handleAnalyzePastedMasterText = () => {
    setMasterImportError('');
    if (!masterImportRawText.trim()) {
      setMasterImportError('Please paste your table or CSV data into the box above.');
      return;
    }
    try {
      const workbook = XLSX.read(masterImportRawText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (json.length === 0) {
        setMasterImportError('No valid rows found. Please ensure your pasted content has header columns (e.g. AccCode, Name, Mobile...).');
        return;
      }
      runMasterAnalysis(json);
    } catch (err) {
      console.error('Error parsing pasted table:', err);
      setMasterImportError('Failed to parse pasted table: ' + err.message);
    }
  };

  // Execute Bulk Master Import & Update
  const handleExecuteMasterImport = async () => {
    if (!masterImportAnalysis) return;

    const toProcess = masterImportAnalysis.allActionable
      .filter(item => masterSelectedAccCodes.includes(item.accCode))
      .filter(item => !item.isNew || masterInsertNew)
      .map(item => item.normalized);

    if (toProcess.length === 0) {
      alert('No contacts selected for update / import.');
      return;
    }

    setIsExecutingMaster(true);
    try {
      const res = await fetch(`${API_BASE}/contacts/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: toProcess,
          insertNew: masterInsertNew
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Bulk import request failed');
      }

      const result = await res.json();
      alert(`Bulk Import Complete!\n\n• Contacts Updated: ${result.updated}\n• New Contacts Inserted: ${result.inserted}\n• Unchanged: ${result.unchanged}`);

      // Refresh database contacts
      const refreshedContactsRes = await fetch(`${API_BASE}/contacts`);
      if (refreshedContactsRes.ok) {
        const data = await refreshedContactsRes.json();
        setContacts(data);
      }

      // Refresh stats
      const today = getTodayString();
      const statsRes = await fetch(`${API_BASE}/stats?today=${today}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Reset modal states
      setShowMasterImportModal(false);
      setMasterImportAnalysis(null);
      setMasterImportRawText('');
      setMasterImportFileName('');
      setMasterImportError('');
      setMasterSelectedAccCodes([]);
    } catch (err) {
      console.error('Bulk import execution error:', err);
      alert('Error during bulk import: ' + err.message);
    } finally {
      setIsExecutingMaster(false);
    }
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
          email_id: newContact.email,
          district: newContact.district,
          area: newContact.area
        })
      });

      if (!res.ok) throw new Error('Failed to add contact');
      
      setShowAddModal(false);
      setNewContact({ name: '', accCode: '', mobile: '', email: '', district: '', area: '' });
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
    return (templateText || '')
      .replace(/{Name}/g, contact.account_name || '')
      .replace(/{AccCode}/g, contact.acc_code || '')
      .replace(/{SerialNo}/g, contact.s_no || '');
  };

  // Copy formatted message (preserving all emojis and newlines) to clipboard
  const copyMessageToClipboard = (contact) => {
    if (!contact) return false;
    const rawMsg = formatTemplateMessage(templates.whatsapp, contact);
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(rawMsg);
      } else {
        const ta = document.createElement('textarea');
        ta.value = rawMsg;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedContactId(contact.id);
      setTimeout(() => setCopiedContactId(null), 2500);
      return true;
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      return false;
    }
  };

  // Compress and resize image client-side to ensure high quality while fitting safely in localStorage (<200KB)
  const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        // Fill white background for transparent PNGs so they don't get black backgrounds in JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  };

  // Copy candidate / campaign photo to system clipboard (as PNG image)
  const copyPhotoToClipboard = async (photoUrl = templatePhoto, showAlert = true) => {
    if (!photoUrl) {
      if (showAlert) alert('No campaign photo selected.');
      return false;
    }
    try {
      const img = new Image();
      if (!photoUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = photoUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not convert image to PNG blob');

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      if (showAlert) {
        alert('📷 Campaign Poster copied to clipboard! In WhatsApp, simply press Ctrl+V to attach it.');
      }
      return true;
    } catch (err) {
      console.warn('Clipboard image write failed:', err);
      if (showAlert) {
        downloadCampaignPhoto(photoUrl);
        alert('Poster downloaded! You can attach it directly in WhatsApp Web or Bulk WhatsApp Sender.');
      }
      return false;
    }
  };

  // Download campaign photo directly to disk
  const downloadCampaignPhoto = (photoUrl = templatePhoto) => {
    if (!photoUrl) return;
    const link = document.createElement('a');
    link.href = photoUrl;
    const cleanFileName = customFlyerName ? customFlyerName.replace(/\.[^/.]+$/, "") + "_Poster.jpg" : 'AnilKumar_Campaign_Poster.jpg';
    link.download = cleanFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload custom campaign flyer/poster
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP).');
      return;
    }
    const fileName = file.name;
    // Clear the input value so user can re-upload the same file if desired
    e.target.value = '';

    try {
      const compressedBase64 = await compressImage(file, 1200, 1200, 0.85);
      setTemplatePhoto(compressedBase64);
      setCustomFlyerData(compressedBase64);
      setCustomFlyerName(fileName);
      setIsPhotoEnabled(true);
      try {
        localStorage.setItem('campaign_template_photo', compressedBase64);
        localStorage.setItem('campaign_custom_flyer_data', compressedBase64);
        localStorage.setItem('campaign_custom_flyer_name', fileName);
        localStorage.setItem('campaign_photo_enabled', 'true');
      } catch (storageErr) {
        console.warn('Could not store flyer in localStorage:', storageErr);
      }
    } catch (err) {
      console.warn('Image compression failed, using direct reader fallback:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        setTemplatePhoto(base64);
        setCustomFlyerData(base64);
        setCustomFlyerName(fileName);
        setIsPhotoEnabled(true);
        try {
          localStorage.setItem('campaign_template_photo', base64);
          localStorage.setItem('campaign_custom_flyer_data', base64);
          localStorage.setItem('campaign_custom_flyer_name', fileName);
          localStorage.setItem('campaign_photo_enabled', 'true');
        } catch (storageErr) {
          console.warn('Could not store flyer in localStorage:', storageErr);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // WhatsApp click handler with direct URL & automatic clipboard copy
  const handleWhatsAppClick = (contact) => {
    const rawMsg = formatTemplateMessage(templates.whatsapp, contact);
    
    // Clean and format mobile number
    const cleanMobile = normalizePhoneNumber(contact.mobile_number) || (contact.mobile_number || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(rawMsg);
    
    // Select direct endpoint (bypasses wa.me HTTP 302 redirect which corrupts multi-byte emojis into '?')
    const url = waSendMode === 'web'
      ? `https://web.whatsapp.com/send?phone=${cleanMobile}&text=${encoded}`
      : `https://api.whatsapp.com/send?phone=${cleanMobile}&text=${encoded}`;
    
    window.open(url, '_blank');
    setWaConfirmContact(contact);

    // If campaign poster is enabled, copy the poster image to clipboard so pressing Ctrl+V in WhatsApp Web attaches the image!
    if (isPhotoEnabled && templatePhoto) {
      copyPhotoToClipboard(templatePhoto, false);
    } else {
      copyMessageToClipboard(contact);
    }
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

  // Export CSV helper with UTF-8 BOM so Excel & Windows software never corrupt emojis into '?'
  const handleExportCSV = (exportFiltered = false) => {
    const listToExport = exportFiltered ? filteredContacts : contacts;
    if (listToExport.length === 0) return;
    
    const headers = ['S.No', 'AccCode', 'AccountName', 'Mobile Number', 'Email ID', 'Email Status', 'Email Sent Date', 'WhatsApp Status', 'SMS Status', 'SMS Sent Date', 'Call Status', 'Call Sent Date', 'Notes', 'Voter Sentiment', 'Exit Poll Status'];
    const rows = listToExport.map(c => [
      c.s_no,
      c.acc_code,
      c.account_name,
      c.mobile_number,
      c.email_id,
      c.email_status,
      c.email_sent_date,
      c.whatsapp_status,
      c.sms_status || 'Pending',
      c.sms_sent_date || '',
      c.call_status,
      c.call_sent_date,
      c.notes,
      c.member_reaction || 'Unknown',
      c.exit_poll_status || 'Pending'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    
    // UTF-8 Byte Order Mark (\uFEFF) forces Windows and Excel to read file as UTF-8 instead of ANSI/Windows-1252
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", blobUrl);
    
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
      } else if (activeTab === 'sms') {
        filename = `sms_campaign_${smsFilter.toLowerCase()}_contacts.csv`;
      } else {
        filename = `campaign_${activeTab}_filtered_contacts.csv`;
      }
    }
    
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  // Export specifically formatted for Bulk WhatsApp Software with 100% preserved emojis
  const handleExportWhatsAppBulkSender = (format = 'xlsx') => {
    const listToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    if (listToExport.length === 0) {
      alert('No contacts available to export.');
      return;
    }

    const dataRows = listToExport.map(c => {
      const cleanPhone = normalizePhoneNumber(c.mobile_number) || (c.mobile_number || '').replace(/\D/g, '');
      const personalizedMsg = formatTemplateMessage(templates.whatsapp, c);
      return {
        'Mobile Number': cleanPhone,
        'Raw Phone': c.mobile_number || '',
        'Name': c.account_name || '',
        'AccCode': c.acc_code || '',
        'SerialNo': c.s_no || '',
        'Message': personalizedMsg,
        'WhatsApp Status': c.whatsapp_status || 'Pending',
        'Voter Sentiment': c.member_reaction || 'Unknown'
      };
    });

    const fileSuffix = whatsappFilter !== 'All' ? `_${whatsappFilter.toLowerCase()}` : '';
    const dateStr = getTodayString();

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulk WhatsApp');
      worksheet['!cols'] = [
        { wch: 18 }, // Mobile Number
        { wch: 18 }, // Raw Phone
        { wch: 28 }, // Name
        { wch: 12 }, // AccCode
        { wch: 10 }, // SerialNo
        { wch: 60 }, // Message
        { wch: 16 }, // Status
        { wch: 24 }  // Sentiment
      ];
      XLSX.writeFile(workbook, `bulk_whatsapp_send_list${fileSuffix}_${dateStr}.xlsx`);
    } else {
      const headers = ['Mobile Number', 'Raw Phone', 'Name', 'AccCode', 'SerialNo', 'Message', 'WhatsApp Status', 'Voter Sentiment'];
      const csvLines = [
        headers.join(','),
        ...dataRows.map(r => [
          `"${String(r['Mobile Number']).replace(/"/g, '""')}"`,
          `"${String(r['Raw Phone']).replace(/"/g, '""')}"`,
          `"${String(r['Name']).replace(/"/g, '""')}"`,
          `"${String(r['AccCode']).replace(/"/g, '""')}"`,
          `"${String(r['SerialNo']).replace(/"/g, '""')}"`,
          `"${String(r['Message']).replace(/"/g, '""')}"`,
          `"${String(r['WhatsApp Status']).replace(/"/g, '""')}"`,
          `"${String(r['Voter Sentiment']).replace(/"/g, '""')}"`
        ].join(','))
      ].join('\r\n');

      const blob = new Blob(["\uFEFF" + csvLines], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", blobUrl);
      link.setAttribute("download", `bulk_whatsapp_send_list${fileSuffix}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }
  };

  // Open Edit Drawer
  const handleOpenDrawer = (contact) => {
    setSelectedContact({ ...contact });
    setIsDrawerOpen(true);
  };

  const handleSaveDrawerDetails = async () => {
    if (!selectedContact) return;
    setIsDrawerOpen(false); // Close drawer immediately for instant feedback
    try {
      await updateContact(selectedContact.id, {
        account_name: selectedContact.account_name,
        acc_code: selectedContact.acc_code,
        mobile_number: selectedContact.mobile_number,
        email_id: selectedContact.email_id,
        email_status: selectedContact.email_status,
        email_sent_date: selectedContact.email_sent_date,
        whatsapp_status: selectedContact.whatsapp_status,
        sms_status: selectedContact.sms_status,
        sms_sent_date: selectedContact.sms_sent_date,
        call_status: selectedContact.call_status,
        call_sent_date: selectedContact.call_sent_date,
        notes: selectedContact.notes,
        member_reaction: selectedContact.member_reaction,
        exit_poll_status: selectedContact.exit_poll_status,
        account_status: selectedContact.account_status,
        assigned_to: selectedContact.assigned_to,
        area: selectedContact.area,
        district: selectedContact.district
      });
    } catch (err) {
      console.error("Error saving drawer details:", err);
    }
  };

  // Filter Contacts
  const getFilteredContacts = () => {
    let list = [...contacts];

    // Filter by Active Status depending on current view
    if (activeTab === 'database') {
      if (statusFilter === 'Active') {
        list = list.filter(c => c.account_status !== 'Inactive');
      } else if (statusFilter === 'Inactive') {
        list = list.filter(c => c.account_status === 'Inactive');
      }
    } else {
      // In campaign tabs, always exclude inactive voters
      list = list.filter(c => c.account_status !== 'Inactive');
    }

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
    } else if (activeTab === 'sms') {
      if (smsFilter !== 'All') {
        list = list.filter(c => (c.sms_status || 'Pending') === smsFilter);
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

    // Global Sentiment Filter
    if (sentimentFilter !== 'All') {
      list = list.filter(c => c.member_reaction === sentimentFilter);
    }

    // District Filter (Master Database tab only)
    if (activeTab === 'database' && districtFilter !== 'All') {
      list = list.filter(c => c.district === districtFilter);
    }

    // Volunteer Filter (Call Center, WhatsApp & SMS tabs)
    if ((activeTab === 'call' || activeTab === 'whatsapp' || activeTab === 'sms') && assignedToFilter !== 'All') {
      list = list.filter(c => c.assigned_to === assignedToFilter);
    }

    return list;
  };

  const filteredContacts = getFilteredContacts();
  const totalItems = filteredContacts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, startIndex + itemsPerPage);

  // Get unique districts dynamically from loaded contacts list
  const uniqueDistricts = [...new Set(contacts.map(c => c.district).filter(Boolean))].sort();

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
  const securedVotes = Number(stats.exitPoll?.secured) || 0;
  const exitPollProgressPct = Math.min((securedVotes / exitPollTarget) * 100, 100);

  // SVG Donut Chart calculation values
  const rReaction = stats.reactions;
  const reactionValues = [
    { key: 'strong', value: Number(rReaction.strong) || 0, ...SENTIMENT_META.strong },
    { key: 'leaning', value: Number(rReaction.leaning) || 0, ...SENTIMENT_META.leaning },
    { key: 'undecided', value: Number(rReaction.undecided) || 0, ...SENTIMENT_META.undecided },
    { key: 'opposed', value: Number(rReaction.opposed) || 0, ...SENTIMENT_META.opposed },
    { key: 'unknown', value: Number(rReaction.unknown) || 0, ...SENTIMENT_META.unknown }
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
              <button className={`nav-link ${activeTab === 'sms' ? 'active' : ''}`} onClick={() => selectTab('sms', true)}>
                <Smartphone size={18} />
                SMS Campaign (Textbee)
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
              <button className={`nav-link ${activeTab === 'volunteers' ? 'active' : ''}`} onClick={() => selectTab('volunteers', true)}>
                <Users size={18} />
                Campaign Volunteers
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
                  <div className="stat-value">{(Number(stats.whatsapp?.sent) || 0) + (Number(stats.whatsapp?.delivered) || 0)}</div>
                  <div className="stat-desc">{stats.whatsapp?.failed || 0} failed • {stats.whatsapp?.pending || 0} pending</div>
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
                        <div className="chart-bar" style={{ height: `${Math.round(((Number(stats.email?.sent) || 0) / (Number(stats.totalContacts) || 1)) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">Email sent ({Math.round(((Number(stats.email?.sent) || 0) / (Number(stats.totalContacts) || 1)) * 100)}%)</span>
                    </div>

                    <div className="chart-bar-wrapper">
                      <div className="chart-bar-track">
                        <div className="chart-bar accent" style={{ height: `${Math.round((((Number(stats.whatsapp?.sent) || 0) + (Number(stats.whatsapp?.delivered) || 0)) / (Number(stats.totalContacts) || 1)) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">WhatsApp ({Math.round((((Number(stats.whatsapp?.sent) || 0) + (Number(stats.whatsapp?.delivered) || 0)) / (Number(stats.totalContacts) || 1)) * 100)}%)</span>
                    </div>

                    <div className="chart-bar-wrapper">
                      <div className="chart-bar-track">
                        <div className="chart-bar success" style={{ height: `${Math.round(((Number(stats.call?.connected) || 0) / (Number(stats.totalContacts) || 1)) * 100)}%` }}></div>
                      </div>
                      <span className="chart-label">Connected Call ({Math.round(((Number(stats.call?.connected) || 0) / (Number(stats.totalContacts) || 1)) * 100)}%)</span>
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
                          {Math.round((((Number(rReaction.strong) || 0) + (Number(rReaction.leaning) || 0)) / (totalSentimentResponses || 1)) * 100)}%
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
                    <MapPin size={16} color="#3b82f6" /> UAE Emirate Distribution
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
                  <div className="stat-value">{Number(stats.exitPoll?.secured) || 0}</div>
                  <div className="stat-desc">Declared voted for Panel</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-header"><span>Lost Votes (Opposition)</span></div>
                  <div className="stat-value">{Number(stats.exitPoll?.lost) || 0}</div>
                  <div className="stat-desc">Declared voted for Opposition</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>Secretive / Unknown</span></div>
                  <div className="stat-value">{Number(stats.exitPoll?.votedUnknown) || 0}</div>
                  <div className="stat-desc">Voted but kept response secret</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Total Booth Exits Logged</span></div>
                  <div className="stat-value">
                    {stats.exitPoll?.totalLogged !== undefined ? stats.exitPoll.totalLogged : (Number(stats.exitPoll?.secured) || 0) + (Number(stats.exitPoll?.lost) || 0) + (Number(stats.exitPoll?.votedUnknown) || 0)}
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
                  <select 
                    className="filter-select" 
                    value={sentimentFilter} 
                    onChange={(e) => { setSentimentFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Sentiments</option>
                    <option value="Strong Support (Panel)">Strong Support</option>
                    <option value="Leaning Support (Anil Kumar only)">Leaning Support</option>
                    <option value="Undecided / Needs Follow-up">Undecided</option>
                    <option value="Opposed">Opposed</option>
                    <option value="Unknown">Unknown / Not Logged</option>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <h2 className="tab-title" style={{ marginBottom: 0 }}>Call Center Operation Sheet</h2>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedContactIds.length > 0 && (
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      {selectedContactIds.length} selected
                    </span>
                  )}
                  <select 
                    className="filter-select"
                    style={{ minWidth: 220 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkCallUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update Call Status...</option>
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
                  <select 
                    className="filter-select"
                    style={{ minWidth: 220 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkSentimentUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update Sentiment...</option>
                    <option value="Unknown">Unknown / Uncontacted</option>
                    <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                    <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                    <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                    <option value="Opposed">🔴 Opposed</option>
                  </select>
                </div>
              </div>

              {/* Stats overview */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Calls Made Today</span></div>
                  <div className="stat-value">{stats.call.calledToday}</div>
                  <div className="stat-desc">Outreach calls completed today</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>Total Sent / Calls Made</span></div>
                  <div className="stat-value" style={{ color: '#fbbf24' }}>
                    {stats.call?.totalSent !== undefined ? stats.call.totalSent : (stats.totalContacts - stats.call.notCalled)}
                  </div>
                  <div className="stat-desc">Cumulative outreach calls completed</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Connected / Support</span></div>
                  <div className="stat-value">{stats.call.connected}</div>
                  <div className="stat-desc">Voters spoke & support confirmed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>No Connect / Retry</span></div>
                  <div className="stat-value">{(Number(stats.call.busy) || 0) + (Number(stats.call.noAnswer) || 0) + (Number(stats.call.noResponse) || 0) + (Number(stats.call.switchedOff) || 0) + (Number(stats.call.reminderRequest) || 0)}</div>
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
                  <select 
                    className="filter-select" 
                    value={sentimentFilter} 
                    onChange={(e) => { setSentimentFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Sentiments</option>
                    <option value="Strong Support (Panel)">Strong Support</option>
                    <option value="Leaning Support (Anil Kumar only)">Leaning Support</option>
                    <option value="Undecided / Needs Follow-up">Undecided</option>
                    <option value="Opposed">Opposed</option>
                    <option value="Unknown">Unknown / Not Logged</option>
                  </select>
                  <select 
                    className="filter-select" 
                    value={assignedToFilter} 
                    onChange={(e) => { setAssignedToFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Volunteers</option>
                    <option value="Unassigned">Unassigned</option>
                    {volunteers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
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
                      <th style={{ width: 40 }}><input type="checkbox" onChange={toggleSelectAll} checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))} /></th>
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
                          <td><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContactSelect(contact.id)} /></td>
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
                        <td colSpan="9" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found.</td>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <h2 className="tab-title" style={{ marginBottom: 0 }}>WhatsApp Click-to-Chat outreach</h2>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className="btn primary" 
                    onClick={() => { 
                      setShowWaImportModal(true); 
                      setWaImportAnalysis(null); 
                      setWaImportRawText(''); 
                      setWaImportTab('sent'); 
                      setWaImportStatus('Sent'); 
                    }} 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
                  >
                    <Upload size={16} /> Import Sent Numbers
                  </button>
                  <button 
                    className="btn"
                    onClick={() => handleExportWhatsAppBulkSender('xlsx')}
                    title="Export ready-to-use Excel file (.xlsx) with 100% preserved emojis for Bulk WhatsApp apps"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#10b981', fontWeight: 600 }}
                  >
                    <Download size={16} /> Export for Bulk App (.xlsx)
                  </button>
                  <button 
                    className="btn"
                    onClick={() => handleExportWhatsAppBulkSender('csv')}
                    title="Export ready-to-use CSV with UTF-8 BOM for Bulk WhatsApp apps"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  >
                    <FileText size={15} /> Export Bulk (.csv)
                  </button>
                  <button 
                    className="btn"
                    onClick={() => downloadCampaignPhoto()}
                    title="Download campaign poster image to attach in Bulk WhatsApp Sender or chat"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  >
                    <ImageIcon size={15} color="#10b981" /> Download Poster
                  </button>
                  <button 
                    className="btn"
                    onClick={() => setShowBulkPhotoGuide(true)}
                    title="Instructions on how to send poster via Bulk WhatsApp App or WhatsApp Web"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'rgba(59, 130, 246, 0.12)', borderColor: '#3b82f6', color: '#60a5fa', fontWeight: 600 }}
                  >
                    <HelpCircle size={15} color="#60a5fa" /> How to Send Poster?
                  </button>
                  <button
                    className="btn"
                    onClick={() => setIsWaComposerOpen(p => !p)}
                    title="Customize WhatsApp message template, photo, and emojis"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: isWaComposerOpen ? '#10b981' : undefined, color: isWaComposerOpen ? '#10b981' : undefined, fontWeight: 600 }}
                  >
                    <Edit2 size={15} /> {isWaComposerOpen ? 'Hide Template' : 'Edit Template & Photo'}
                  </button>
                  {selectedContactIds.length > 0 && (
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      {selectedContactIds.length} selected
                    </span>
                  )}
                  <select 
                    className="filter-select"
                    style={{ minWidth: 220 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkWhatsAppUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update WhatsApp Status...</option>
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <select 
                    className="filter-select"
                    style={{ minWidth: 220 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkSentimentUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update Sentiment...</option>
                    <option value="Unknown">Unknown / Uncontacted</option>
                    <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                    <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                    <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                    <option value="Opposed">🔴 Opposed</option>
                  </select>
                </div>
              </div>

              {/* Stats Row */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Sent Today</span></div>
                  <div className="stat-value">{stats.whatsapp.sentToday}</div>
                  <div className="stat-desc">WhatsApp messages sent today</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Total Sent</span></div>
                  <div className="stat-value" style={{ color: '#10b981' }}>
                    {stats.whatsapp.totalSent !== undefined ? stats.whatsapp.totalSent : ((Number(stats.whatsapp.sent) || 0) + (Number(stats.whatsapp.delivered) || 0))}
                  </div>
                  <div className="stat-desc">Cumulative messages dispatched</div>
                </div>
                <div className="stat-card">
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
                  <select 
                    className="filter-select" 
                    value={sentimentFilter} 
                    onChange={(e) => { setSentimentFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Sentiments</option>
                    <option value="Strong Support (Panel)">Strong Support</option>
                    <option value="Leaning Support (Anil Kumar only)">Leaning Support</option>
                    <option value="Undecided / Needs Follow-up">Undecided</option>
                    <option value="Opposed">Opposed</option>
                    <option value="Unknown">Unknown / Not Logged</option>
                  </select>
                  <select 
                    className="filter-select" 
                    value={assignedToFilter} 
                    onChange={(e) => { setAssignedToFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Volunteers</option>
                    <option value="Unassigned">Unassigned</option>
                    {volunteers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select 
                    className="filter-select"
                    value={waSendMode}
                    onChange={(e) => setWaSendMode(e.target.value)}
                    title="Choose Click-to-Chat target"
                  >
                    <option value="web">Mode: Direct WhatsApp Web</option>
                    <option value="api">Mode: WhatsApp API / Mobile App</option>
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

              {/* Inline WhatsApp Message Composer & Emoji Bar */}
              {isWaComposerOpen && (
                <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MessageSquare size={18} color="#10b981" />
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-white)' }}>
                        WhatsApp Message Template (UTF-8 Emojis Preserved)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Insert Tag:</span>
                      <button 
                        type="button" 
                        className="var-tag-btn"
                        onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {Name}' }))}
                      >
                        + &#123;Name&#125;
                      </button>
                      <button 
                        type="button" 
                        className="var-tag-btn"
                        onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {AccCode}' }))}
                      >
                        + &#123;AccCode&#125;
                      </button>
                      <button 
                        type="button" 
                        className="var-tag-btn"
                        onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {SerialNo}' }))}
                      >
                        + &#123;SerialNo&#125;
                      </button>
                    </div>
                  </div>

                  {/* Emoji Bar */}
                  <div className="emoji-bar">
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 6 }}>Quick Emojis:</span>
                    {CAMPAIGN_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-chip"
                        title={`Insert ${emoji}`}
                        onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' ' + emoji }))}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Campaign Photo / Poster Attachment Section */}
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--color-text-white)' }}>
                        <input 
                          type="checkbox" 
                          checked={isPhotoEnabled} 
                          onChange={(e) => setIsPhotoEnabled(e.target.checked)} 
                        />
                        <ImageIcon size={16} color="#10b981" />
                        <span>Campaign Poster / Candidate Photo</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button 
                          type="button" 
                          className="btn" 
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => copyPhotoToClipboard()}
                          title="Copy photo directly to clipboard so you can press Ctrl+V into WhatsApp"
                        >
                          <Copy size={12} /> Copy Photo (Ctrl+V)
                        </button>
                        <button 
                          type="button" 
                          className="btn" 
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => downloadCampaignPhoto()}
                          title="Download photo for Bulk WhatsApp App or WhatsApp Web"
                        >
                          <Download size={12} /> Download Poster
                        </button>
                      </div>
                    </div>

                    {isPhotoEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                        <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '2px solid #10b981', flexShrink: 0, background: '#000' }}>
                          <img 
                            src={templatePhoto} 
                            alt="Campaign Poster" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                          {(templatePhoto.startsWith('data:') || (customFlyerData && templatePhoto === customFlyerData)) && (
                            <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,185,129,0.92)', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center', padding: '1px 0', letterSpacing: '0.5px' }}>
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Choose Photo:</span>
                            <button 
                              type="button" 
                              className="var-tag-btn" 
                              style={{ borderColor: templatePhoto === '/candidates/anil.jpg' ? '#10b981' : undefined, color: templatePhoto === '/candidates/anil.jpg' ? '#10b981' : undefined }}
                              onClick={() => setTemplatePhoto('/candidates/anil.jpg')}
                            >
                              Anil Kumar (Candidate #3)
                            </button>
                            <button 
                              type="button" 
                              className="var-tag-btn" 
                              style={{ borderColor: templatePhoto === '/candidates/balakrishnan.jpg' ? '#10b981' : undefined, color: templatePhoto === '/candidates/balakrishnan.jpg' ? '#10b981' : undefined }}
                              onClick={() => setTemplatePhoto('/candidates/balakrishnan.jpg')}
                            >
                              Balan (President)
                            </button>
                            <input 
                              type="file" 
                              ref={waFlyerInputRef} 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={handlePhotoUpload} 
                            />
                            {customFlyerData ? (
                              <button 
                                type="button"
                                className="var-tag-btn" 
                                style={{ 
                                  cursor: 'pointer', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 4,
                                  borderColor: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                  color: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                  background: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? 'rgba(16,185,129,0.12)' : undefined,
                                  fontWeight: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? 600 : 400
                                }}
                                onClick={() => {
                                  if (templatePhoto !== customFlyerData) {
                                    setTemplatePhoto(customFlyerData);
                                  } else {
                                    waFlyerInputRef.current?.click();
                                  }
                                }}
                                title="Click to select or click again to replace flyer"
                              >
                                <Upload size={11} /> {(templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? (customFlyerName ? `✓ Custom: ${customFlyerName.length > 18 ? customFlyerName.slice(0, 15) + '...' : customFlyerName}` : '✓ Custom Flyer') : `Custom: ${customFlyerName ? (customFlyerName.length > 12 ? customFlyerName.slice(0, 9) + '...' : customFlyerName) : 'Flyer'}`}
                              </button>
                            ) : null}
                            <button 
                              type="button"
                              className="var-tag-btn" 
                              style={{ 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4,
                                borderColor: (!customFlyerData && templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                color: (!customFlyerData && templatePhoto.startsWith('data:')) ? '#10b981' : undefined
                              }}
                              onClick={() => waFlyerInputRef.current?.click()}
                            >
                              <Upload size={11} /> {customFlyerData ? 'Upload New Flyer' : 'Upload Custom Flyer'}
                            </button>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            💡 <em>Click <strong>Copy Photo</strong> to copy the image, then in WhatsApp Web press <strong>Ctrl+V</strong> to attach it! In Bulk WhatsApp apps, attach this poster using the 'Attach Media' button.</em>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <textarea 
                    className="drawer-textarea"
                    style={{ minHeight: 110, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', width: '100%', marginBottom: 8 }}
                    value={templates.whatsapp}
                    onChange={(e) => setTemplates(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="Type your WhatsApp message template with emojis..."
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={14} /> Unicode emojis active • Click 'Send Message' or 'Copy' to copy directly to clipboard
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button"
                        className="btn"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(templates.whatsapp);
                          alert('WhatsApp template copied to clipboard with all emojis!');
                        }}
                      >
                        <Copy size={13} /> Copy Template
                      </button>
                      <button 
                        type="button"
                        className="btn primary"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                        onClick={() => {
                          localStorage.setItem('campaign_templates', JSON.stringify(templates));
                          alert('WhatsApp template saved! Emojis and formatting are permanently stored.');
                        }}
                      >
                        <Save size={13} /> Save Template
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><input type="checkbox" onChange={toggleSelectAll} checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))} /></th>
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
                          <td><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContactSelect(contact.id)} /></td>
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
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn" 
                                onClick={() => copyMessageToClipboard(contact)}
                                title="Copy personalized message with emojis to clipboard (Ctrl+V into WhatsApp)"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }}
                              >
                                <Copy size={13} /> {copiedContactId === contact.id ? 'Copied!' : 'Copy'}
                              </button>
                              <button 
                                className="btn primary" 
                                onClick={() => handleWhatsAppClick(contact)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              >
                                <MessageSquare size={14} /> Send Message <ExternalLink size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found.</td>
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

          {/* ==================== SMS CAMPAIGN (TEXTBEE) TAB ==================== */}
          {activeTab === 'sms' && (
            <div>
              {/* Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 className="tab-title" style={{ marginBottom: 0 }}>SMS Campaign (Textbee Android Gateway)</h2>
                    {textbeeConfig.isConfigured ? (
                      <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        ● Android Gateway Ready
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        ⚠ Set TEXTBEE_API_KEY in backend .env
                      </span>
                    )}
                    {textbeeConfig.hasWebhookSecret ? (
                      <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        ● Webhook Verified (HMAC)
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', background: 'rgba(107, 114, 128, 0.15)', color: 'var(--color-text-muted)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '12px' }} title="Add TEXTBEE_WEBHOOK_SECRET in backend .env">
                        Webhook: /api/sms/webhook
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: 4 }}>
                    Dispatches personalized SMS messages directly via connected Android phone SIM. Webhook receives real-time delivery status and voter SMS replies.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => { fetchIncomingSms(); setShowSmsInboxModal(true); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}
                  >
                    <Inbox size={14} /> SMS Inbox / Replies
                    {incomingSmsList.length > 0 && (
                      <span style={{
                        background: '#3b82f6',
                        color: '#fff',
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 700
                      }}>
                        {incomingSmsList.length}
                      </span>
                    )}
                  </button>
                  {selectedContactIds.length > 0 && (
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                      {selectedContactIds.length} selected
                    </span>
                  )}
                  <button 
                    className="btn primary" 
                    disabled={selectedContactIds.length === 0 || isSendingSms}
                    onClick={() => handleBroadcastSms(selectedContactIds)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Send size={14} /> Broadcast Selected ({selectedContactIds.length})
                  </button>
                  <select 
                    className="filter-select"
                    style={{ minWidth: 200 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkSmsUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update SMS Status...</option>
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Failed">Failed</option>
                  </select>
                  <select 
                    className="filter-select"
                    style={{ minWidth: 200 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedContactIds.length > 0) {
                        handleBulkSentimentUpdate(e.target.value);
                      }
                    }}
                    disabled={selectedContactIds.length === 0}
                  >
                    <option value="" disabled hidden>Bulk Update Sentiment...</option>
                    <option value="Unknown">Unknown / Uncontacted</option>
                    <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                    <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                    <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                    <option value="Opposed">🔴 Opposed</option>
                  </select>
                </div>
              </div>

              {/* Top Section: SMS Composer & Test Panel */}
              <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: 24, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Smartphone size={18} color="#ec4899" />
                    <h3 className="panel-title" style={{ margin: 0, fontSize: 15 }}>SMS Message Composer</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Insert Tag:</span>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {Name}' }))}
                    >
                      + &#123;Name&#125;
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {SerialNo}' }))}
                    >
                      + &#123;SerialNo&#125;
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {AccCode}' }))}
                    >
                      + &#123;AccCode&#125;
                    </button>
                  </div>
                </div>

                <textarea 
                  className="drawer-textarea"
                  style={{ minHeight: '84px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', width: '100%', marginBottom: 12 }}
                  value={templates.sms}
                  onChange={(e) => setTemplates(p => ({ ...p, sms: e.target.value }))}
                  placeholder="Enter SMS message template with tags..."
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span>
                      Length: <strong style={{ color: templates.sms.length > 160 ? '#f59e0b' : 'var(--color-text-white)' }}>{templates.sms.length}</strong> chars
                      &nbsp;(~{Math.ceil(templates.sms.length / 160) || 1} SMS segment{templates.sms.length > 160 ? 's' : ''})
                    </span>
                    <span>•</span>
                    <span style={{ color: '#10b981' }}>✓ 2-second carrier pacing enabled</span>
                  </div>

                  {/* Send Test SMS Box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input 
                      type="text" 
                      className="search-input" 
                      placeholder="e.g. +971501234567" 
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      style={{ width: 180, padding: '6px 10px', fontSize: 12 }}
                    />
                    <button 
                      className="btn" 
                      onClick={handleSendTestSms}
                      disabled={isSendingSms || !testSmsPhone.trim()}
                      style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      <Send size={12} /> Send Test SMS
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Sent Today</span></div>
                  <div className="stat-value">{stats?.sms?.sentToday || 0}</div>
                  <div className="stat-desc">SMS dispatched today via phone</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-header"><span>Total Sent</span></div>
                  <div className="stat-value">{stats?.sms?.sent || 0}</div>
                  <div className="stat-desc">Confirmed dispatched to voter</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-header"><span>Failed / Error</span></div>
                  <div className="stat-value">{stats?.sms?.failed || 0}</div>
                  <div className="stat-desc">Invalid mobile or carrier error</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-header"><span>Pending Outreach</span></div>
                  <div className="stat-value">{stats?.sms?.pending || 0}</div>
                  <div className="stat-desc">Voters waiting for SMS</div>
                </div>
              </div>

              {/* Controls bar */}
              <div className="controls-bar">
                <div className="search-wrapper">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by voter name, AccCode, mobile..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div className="filter-group">
                  <select 
                    className="filter-select"
                    value={smsFilter}
                    onChange={(e) => {
                      setSmsFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">All SMS Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
                    <option value="Failed">Failed</option>
                  </select>

                  <select 
                    className="filter-select"
                    value={sentimentFilter}
                    onChange={(e) => {
                      setSentimentFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">All Sentiments</option>
                    <option value="Unknown">Unknown / Uncontacted</option>
                    <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                    <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                    <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                    <option value="Opposed">🔴 Opposed</option>
                  </select>

                  <select 
                    className="filter-select"
                    value={assignedToFilter}
                    onChange={(e) => {
                      setAssignedToFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">All Volunteers</option>
                    <option value="Unassigned">Unassigned</option>
                    {volunteers.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>

                  <button className="btn" onClick={() => handleExportCSV(true)}>Export CSV</button>
                </div>
              </div>

              {/* Table wrapper */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>S.No</th>
                      <th>AccCode</th>
                      <th>Voter Name</th>
                      <th>Mobile (UAE)</th>
                      <th>District</th>
                      <th>Volunteer</th>
                      <th>Sentiment</th>
                      <th>SMS Status</th>
                      <th>Sent Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedContactIds.includes(contact.id)}
                              onChange={() => toggleContactSelect(contact.id)}
                            />
                          </td>
                          <td>{contact.s_no}</td>
                          <td><span className="badge code">{contact.acc_code}</span></td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                          <td>{contact.mobile_number ? `+${contact.mobile_number}` : <span style={{ color: '#ef4444', fontStyle: 'italic' }}>None</span>}</td>
                          <td>{contact.district || '—'}</td>
                          <td>
                            {contact.assigned_to && contact.assigned_to !== 'Unassigned' ? (
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#38bdf8' }}>{contact.assigned_to}</span>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Unassigned</span>
                            )}
                          </td>
                          <td>
                            {contact.member_reaction && contact.member_reaction !== 'Unknown' ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === contact.member_reaction)]?.color }}>
                                {contact.member_reaction.split(' (')[0]}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${(contact.sms_status || 'Pending').toLowerCase()}`}>
                              {contact.sms_status || 'Pending'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{contact.sms_sent_date || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button 
                                className="btn primary" 
                                onClick={() => handleSendSingleSms(contact)}
                                disabled={isSendingSms || !contact.mobile_number}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}
                                title="Send SMS directly via connected Android phone"
                              >
                                <Smartphone size={12} /> Send SMS
                              </button>
                              <button 
                                className="action-btn"
                                onClick={() => handleOpenDrawer(contact)}
                                title="Edit Details"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found matching selection.</td>
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
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button 
                    className="btn primary" 
                    onClick={() => { setShowMasterImportModal(true); setMasterImportAnalysis(null); setMasterImportError(''); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6366f1', borderColor: '#6366f1' }}
                  >
                    <Upload size={16} /> Bulk Import / Update
                  </button>
                  <button className="btn warning" onClick={() => selectTab('volunteers', true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} /> Manage Volunteers
                  </button>
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
                <div className="search-wrapper">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by Name, S.No, Account Code, Phone, or Email ID..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="filters-wrapper">
                  {selectedContactIds.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 10px', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-white)', fontWeight: 600 }}>
                        {selectedContactIds.length} Selected
                      </span>
                      <select 
                        className="filter-select"
                        style={{ padding: '4px 8px', fontSize: 12, height: 'auto', border: '1px solid var(--border-color)', margin: 0 }}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleBulkAssignVolunteers(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="" disabled>Assign to...</option>
                        <option value="Unassigned">Unassigned</option>
                        {volunteers.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <select 
                        className="filter-select"
                        style={{ padding: '4px 8px', fontSize: 12, height: 'auto', border: '1px solid var(--border-color)', margin: 0 }}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleBulkSentimentUpdate(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="" disabled>Sentiment...</option>
                        <option value="Unknown">Unknown / Uncontacted</option>
                        <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                        <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                        <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                        <option value="Opposed">🔴 Opposed</option>
                      </select>
                    </div>
                  )}
                  <select 
                    className="filter-select" 
                    value={statusFilter} 
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="Active">Active Only</option>
                    <option value="Inactive">Inactive Only</option>
                    <option value="All">All Statuses</option>
                  </select>
                  <select 
                    className="filter-select" 
                    value={sentimentFilter} 
                    onChange={(e) => { setSentimentFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Sentiments</option>
                    <option value="Strong Support (Panel)">Strong Support</option>
                    <option value="Leaning Support (Anil Kumar only)">Leaning Support</option>
                    <option value="Undecided / Needs Follow-up">Undecided</option>
                    <option value="Opposed">Opposed</option>
                    <option value="Unknown">Unknown / Not Logged</option>
                  </select>
                  <select 
                    className="filter-select" 
                    value={districtFilter} 
                    onChange={(e) => { setDistrictFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="All">All Districts</option>
                    {uniqueDistricts.map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Full Contacts Table */}
              <div className="table-wrapper">
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input 
                          type="checkbox" 
                          onChange={toggleSelectAll} 
                          checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id))} 
                        />
                      </th>
                      <th>S.No</th>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>District</th>
                      <th>Area</th>
                      <th>Mobile Number</th>
                      <th>Email ID</th>
                      <th>Sentiment</th>
                      <th>Email Status</th>
                      <th>Call Status</th>
                      <th>WhatsApp</th>
                      <th>SMS</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedContacts.length > 0 ? (
                      paginatedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedContactIds.includes(contact.id)} 
                              onChange={() => toggleContactSelect(contact.id)} 
                            />
                          </td>
                          <td>{contact.s_no}</td>
                          <td>{contact.acc_code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>
                            {contact.account_name}
                            {contact.account_status === 'Inactive' && (
                              <span className="status-badge failed" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', textTransform: 'uppercase' }}>Inactive</span>
                            )}
                          </td>
                          <td>{contact.district || '—'}</td>
                          <td>{contact.area || '—'}</td>
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
                          <td><span className={`status-badge ${(contact.sms_status || 'Pending').toLowerCase()}`}>{contact.sms_status || 'Pending'}</span></td>
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
                        <td colSpan="13" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No contacts found matching selection.</td>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 className="panel-title" style={{ color: '#10b981', margin: 0 }}>
                      <MessageSquare size={18} /> WhatsApp Message Template
                    </h3>
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>UTF-8 Unicode Emojis</span>
                  </div>
                  <div className="template-variables" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Insert Tag:</span>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {Name}' }))}>+ &#123;Name&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {AccCode}' }))}>+ &#123;AccCode&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' {SerialNo}' }))}>+ &#123;SerialNo&#125;</button>
                  </div>
                  {/* Emoji Quick-Bar */}
                  <div className="emoji-bar">
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 4 }}>Quick Emojis:</span>
                    {CAMPAIGN_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-chip"
                        title={`Insert ${emoji}`}
                        onClick={() => setTemplates(p => ({ ...p, whatsapp: p.whatsapp + ' ' + emoji }))}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Campaign Photo / Poster Attachment Section */}
                  <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--color-text-white)' }}>
                        <input 
                          type="checkbox" 
                          checked={isPhotoEnabled} 
                          onChange={(e) => setIsPhotoEnabled(e.target.checked)} 
                        />
                        <ImageIcon size={16} color="#10b981" />
                        <span>Campaign Poster / Candidate Photo</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button 
                          type="button" 
                          className="btn" 
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => copyPhotoToClipboard()}
                          title="Copy photo directly to clipboard so you can press Ctrl+V into WhatsApp"
                        >
                          <Copy size={12} /> Copy Photo (Ctrl+V)
                        </button>
                        <button 
                          type="button" 
                          className="btn" 
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => downloadCampaignPhoto()}
                          title="Download photo for Bulk WhatsApp App or WhatsApp Web"
                        >
                          <Download size={12} /> Download Poster
                        </button>
                      </div>
                    </div>

                    {isPhotoEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                        <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '2px solid #10b981', flexShrink: 0, background: '#000' }}>
                          <img 
                            src={templatePhoto} 
                            alt="Campaign Poster" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                          {(templatePhoto.startsWith('data:') || (customFlyerData && templatePhoto === customFlyerData)) && (
                            <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,185,129,0.92)', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center', padding: '1px 0', letterSpacing: '0.5px' }}>
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Choose Photo:</span>
                            <button 
                              type="button" 
                              className="var-tag-btn" 
                              style={{ borderColor: templatePhoto === '/candidates/anil.jpg' ? '#10b981' : undefined, color: templatePhoto === '/candidates/anil.jpg' ? '#10b981' : undefined }}
                              onClick={() => setTemplatePhoto('/candidates/anil.jpg')}
                            >
                              Anil Kumar (Candidate #3)
                            </button>
                            <button 
                              type="button" 
                              className="var-tag-btn" 
                              style={{ borderColor: templatePhoto === '/candidates/balakrishnan.jpg' ? '#10b981' : undefined, color: templatePhoto === '/candidates/balakrishnan.jpg' ? '#10b981' : undefined }}
                              onClick={() => setTemplatePhoto('/candidates/balakrishnan.jpg')}
                            >
                              Balan (President)
                            </button>
                            <input 
                              type="file" 
                              ref={tplFlyerInputRef} 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={handlePhotoUpload} 
                            />
                            {customFlyerData ? (
                              <button 
                                type="button"
                                className="var-tag-btn" 
                                style={{ 
                                  cursor: 'pointer', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 4,
                                  borderColor: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                  color: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                  background: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? 'rgba(16,185,129,0.12)' : undefined,
                                  fontWeight: (templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? 600 : 400
                                }}
                                onClick={() => {
                                  if (templatePhoto !== customFlyerData) {
                                    setTemplatePhoto(customFlyerData);
                                  } else {
                                    tplFlyerInputRef.current?.click();
                                  }
                                }}
                                title="Click to select or click again to replace flyer"
                              >
                                <Upload size={11} /> {(templatePhoto === customFlyerData || templatePhoto.startsWith('data:')) ? (customFlyerName ? `✓ Custom: ${customFlyerName.length > 18 ? customFlyerName.slice(0, 15) + '...' : customFlyerName}` : '✓ Custom Flyer') : `Custom: ${customFlyerName ? (customFlyerName.length > 12 ? customFlyerName.slice(0, 9) + '...' : customFlyerName) : 'Flyer'}`}
                              </button>
                            ) : null}
                            <button 
                              type="button"
                              className="var-tag-btn" 
                              style={{ 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4,
                                borderColor: (!customFlyerData && templatePhoto.startsWith('data:')) ? '#10b981' : undefined,
                                color: (!customFlyerData && templatePhoto.startsWith('data:')) ? '#10b981' : undefined
                              }}
                              onClick={() => tplFlyerInputRef.current?.click()}
                            >
                              <Upload size={11} /> {customFlyerData ? 'Upload New Flyer' : 'Upload Custom Flyer'}
                            </button>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            💡 <em>Click <strong>Copy Photo</strong> to copy the image, then in WhatsApp Web press <strong>Ctrl+V</strong> to attach it! In Bulk WhatsApp apps, attach this poster using the 'Attach Media' button.</em>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <textarea 
                    className="drawer-textarea" 
                    value={templates.whatsapp} 
                    onChange={(e) => setTemplates(p => ({ ...p, whatsapp: e.target.value }))}
                    style={{ height: 160 }}
                    placeholder="Enter WhatsApp template with emojis..."
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(templates.whatsapp);
                        alert('WhatsApp template copied to clipboard with all emojis!');
                      }}
                    >
                      <Copy size={14} /> Copy Template
                    </button>
                    <button 
                      type="button" 
                      className="btn primary" 
                      onClick={() => {
                        localStorage.setItem('campaign_templates', JSON.stringify(templates));
                        alert('WhatsApp template saved! Emojis and formatting are permanently stored locally.');
                      }}
                    >
                      <Save size={14} /> Save Template
                    </button>
                  </div>
                </div>

                {/* Email template card */}
                <div className="template-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 className="panel-title" style={{ color: '#3b82f6', margin: 0 }}>
                      <Mail size={18} /> Email Message Template
                    </h3>
                  </div>
                  <div className="template-variables" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Insert Tag:</span>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, email: p.email + ' {Name}' }))}>+ &#123;Name&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, email: p.email + ' {AccCode}' }))}>+ &#123;AccCode&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, email: p.email + ' {SerialNo}' }))}>+ &#123;SerialNo&#125;</button>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.email} 
                    onChange={(e) => setTemplates(p => ({ ...p, email: e.target.value }))}
                    style={{ height: 195 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(templates.email);
                        alert('Email template copied to clipboard!');
                      }}
                    >
                      <Copy size={14} /> Copy Template
                    </button>
                    <button 
                      type="button" 
                      className="btn primary" 
                      onClick={() => {
                        localStorage.setItem('campaign_templates', JSON.stringify(templates));
                        alert('Email template updated locally!');
                      }}
                    >
                      <Save size={14} /> Save Template
                    </button>
                  </div>
                </div>

                {/* Call center script card */}
                <div className="template-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 className="panel-title" style={{ color: '#f59e0b', margin: 0 }}>
                      <Phone size={18} /> Call Center Talk Script
                    </h3>
                  </div>
                  <div className="template-variables" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Insert Tag:</span>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, callScript: p.callScript + ' {Name}' }))}>+ &#123;Name&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, callScript: p.callScript + ' {AccCode}' }))}>+ &#123;AccCode&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, callScript: p.callScript + ' {SerialNo}' }))}>+ &#123;SerialNo&#125;</button>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.callScript} 
                    onChange={(e) => setTemplates(p => ({ ...p, callScript: e.target.value }))}
                    style={{ height: 195 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(templates.callScript);
                        alert('Call script copied to clipboard!');
                      }}
                    >
                      <Copy size={14} /> Copy Script
                    </button>
                    <button 
                      type="button" 
                      className="btn primary" 
                      onClick={() => {
                        localStorage.setItem('campaign_templates', JSON.stringify(templates));
                        alert('Call script template updated locally!');
                      }}
                    >
                      <Save size={14} /> Save Script
                    </button>
                  </div>
                </div>

                {/* SMS Textbee template card */}
                <div className="template-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 className="panel-title" style={{ color: '#ec4899', margin: 0 }}>
                      <Smartphone size={18} /> SMS Template (Textbee Android Gateway)
                    </h3>
                  </div>
                  <div className="template-variables" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Insert Tag:</span>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {Name}' }))}>+ &#123;Name&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {AccCode}' }))}>+ &#123;AccCode&#125;</button>
                    <button type="button" className="var-tag-btn" onClick={() => setTemplates(p => ({ ...p, sms: p.sms + ' {SerialNo}' }))}>+ &#123;SerialNo&#125;</button>
                  </div>
                  <textarea 
                    className="drawer-textarea" 
                    value={templates.sms} 
                    onChange={(e) => setTemplates(p => ({ ...p, sms: e.target.value }))}
                    style={{ height: 160 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {templates.sms.length} chars (~{Math.ceil(templates.sms.length / 160) || 1} SMS)
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => {
                          navigator.clipboard.writeText(templates.sms);
                          alert('SMS template copied to clipboard!');
                        }}
                      >
                        <Copy size={14} /> Copy
                      </button>
                      <button 
                        type="button" 
                        className="btn primary" 
                        onClick={() => {
                          localStorage.setItem('campaign_templates', JSON.stringify(templates));
                          alert('SMS template updated locally!');
                        }}
                      >
                        <Save size={14} /> Save Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VOLUNTEERS TAB ==================== */}
          {activeTab === 'volunteers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 className="tab-title">Campaign Volunteers Dashboard</h2>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '4px 12px', borderRadius: 6, fontWeight: 600 }}>
                  Caller Command Center
                </span>
              </div>

              {/* Volunteers Overview Stats Grid */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-header"><span>Registered Helpers</span></div>
                  <div className="stat-value" style={{ color: '#fbbf24' }}>{volunteers.length}</div>
                  <div className="stat-desc">Total callers in database</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Active Assigned Workload</span></div>
                  <div className="stat-value" style={{ color: '#3b82f6' }}>{(() => {
                    let totalWorkload = 0;
                    volunteers.forEach(name => {
                      totalWorkload += contacts.filter(c => c.assigned_to === name && c.account_status !== 'Inactive').length;
                    });
                    return totalWorkload;
                  })()}</div>
                  <div className="stat-desc">Total voters allocated to callers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header"><span>Workload Progress</span></div>
                  <div className="stat-value" style={{ color: '#10b981' }}>{(() => {
                    let totalWorkload = 0;
                    let completedCalls = 0;
                    volunteers.forEach(name => {
                      const assigned = contacts.filter(c => c.assigned_to === name && c.account_status !== 'Inactive');
                      totalWorkload += assigned.length;
                      completedCalls += assigned.filter(c => c.call_status !== 'Not Called').length;
                    });
                    return totalWorkload > 0 ? Math.round((completedCalls / totalWorkload) * 100) : 0;
                  })()}%</div>
                  <div className="stat-desc">{(() => {
                    let totalWorkload = 0;
                    let completedCalls = 0;
                    volunteers.forEach(name => {
                      const assigned = contacts.filter(c => c.assigned_to === name && c.account_status !== 'Inactive');
                      totalWorkload += assigned.length;
                      completedCalls += assigned.filter(c => c.call_status !== 'Not Called').length;
                    });
                    return `${completedCalls} of ${totalWorkload}`;
                  })()} calls complete</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: selectedVolunteerDetail ? '1fr 1.3fr' : '1fr', gap: 24, transition: 'all 0.3s ease' }}>
                
                {/* Volunteers Directory Column */}
                <div className="glass-panel" style={{ padding: 20 }}>
                  <h3 className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span>Helper Directory</span>
                    <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                      Click volunteer to view workload
                    </span>
                  </h3>

                  {/* Add Helper Inline Form */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <input 
                      type="text" 
                      className="drawer-input" 
                      placeholder="Add external or internal volunteer..." 
                      value={newVolunteerName}
                      onChange={(e) => setNewVolunteerName(e.target.value)}
                      style={{ margin: 0, height: 38, fontSize: 13 }}
                    />
                    <button className="btn success" onClick={handleAddVolunteer} style={{ height: 38, padding: '0 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <Plus size={14} /> Add Helper
                    </button>
                  </div>

                  {/* Directory Table */}
                  <div className="table-wrapper" style={{ overflowY: 'auto', maxHeight: 450 }}>
                    <table className="contacts-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Helper Name</th>
                          <th style={{ textAlign: 'center' }}>Workload</th>
                          <th style={{ textAlign: 'center' }}>Progress</th>
                          <th style={{ textAlign: 'center' }}>Success</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volunteers.length > 0 ? (
                          volunteers.map((name) => {
                            const assigned = contacts.filter(c => c.assigned_to === name && c.account_status !== 'Inactive');
                            const workload = assigned.length;
                            const done = assigned.filter(c => c.call_status !== 'Not Called').length;
                            const rate = workload > 0 ? Math.round((done / workload) * 100) : 0;
                            const positive = assigned.filter(c => c.member_reaction === 'Strong Support (Panel)' || c.member_reaction === 'Leaning Support (Anil Kumar only)').length;
                            const success = done > 0 ? Math.round((positive / done) * 100) : 0;

                            return (
                              <tr 
                                key={name} 
                                onClick={() => setSelectedVolunteerDetail(name)}
                                style={{ 
                                  cursor: 'pointer', 
                                  background: selectedVolunteerDetail === name ? 'rgba(99, 102, 241, 0.08)' : '',
                                  borderLeft: selectedVolunteerDetail === name ? '3px solid #6366f1' : ''
                                }}
                              >
                                <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{name}</td>
                                <td style={{ textAlign: 'center', color: '#60a5fa' }}>{workload}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600, color: rate > 70 ? '#34d399' : rate > 30 ? '#fbbf24' : 'var(--color-text-muted)' }}>
                                    {rate}%
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4 }}>({done}/{workload})</span>
                                </td>
                                <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{success}%</td>
                                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    className="action-btn"
                                    style={{ color: '#ef4444' }}
                                    title="Delete Helper"
                                    onClick={() => handleDeleteVolunteer(name)}
                                  >
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                              No volunteers registered yet. Add a helper above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Inspect Workload Drill-Down Column */}
                {selectedVolunteerDetail && (
                  <div className="glass-panel" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                      <div>
                        <h3 className="panel-title" style={{ marginBottom: 2 }}>
                          Workload: <span style={{ color: '#fbbf24' }}>{selectedVolunteerDetail}</span>
                        </h3>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          Voters assigned: {contacts.filter(c => c.assigned_to === selectedVolunteerDetail && c.account_status !== 'Inactive').length}
                        </span>
                      </div>
                      <button className="close-btn" style={{ padding: 4 }} onClick={() => setSelectedVolunteerDetail(null)}>×</button>
                    </div>

                    <div className="table-wrapper" style={{ overflowY: 'auto', maxHeight: 440 }}>
                      <table className="contacts-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>S.No</th>
                            <th>Voter Name</th>
                            <th>Call Status</th>
                            <th>Sentiment</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const assignedVoters = contacts.filter(c => c.assigned_to === selectedVolunteerDetail && c.account_status !== 'Inactive');
                            return assignedVoters.length > 0 ? (
                              assignedVoters.map((contact) => (
                                <tr key={contact.id}>
                                  <td>{contact.s_no}</td>
                                  <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{contact.account_name}</td>
                                  <td>
                                    <span className={`status-badge ${contact.call_status.toLowerCase().replace(' ', '-')}`}>
                                      {contact.call_status}
                                    </span>
                                  </td>
                                  <td>
                                    {contact.member_reaction && contact.member_reaction !== 'Unknown' ? (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: SENTIMENT_META[Object.keys(SENTIMENT_META).find(k => SENTIMENT_META[k].label === contact.member_reaction)]?.color }}>
                                        {contact.member_reaction.split(' (')[0]}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button 
                                        className="action-btn"
                                        title="Log Notes"
                                        onClick={() => handleOpenDrawer(contact)}
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button 
                                        className="action-btn"
                                        style={{ color: '#ef4444' }}
                                        title="Unassign Voter"
                                        onClick={async () => {
                                          if (window.confirm(`Unassign "${contact.account_name}" from caller "${selectedVolunteerDetail}"?`)) {
                                            await updateContact(contact.id, { assigned_to: 'Unassigned' });
                                          }
                                        }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                                  No active voters currently assigned to this helper.
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
              <div className="drawer-field">
                <span className="drawer-label">District</span>
                <input 
                  type="text" 
                  className="drawer-input" 
                  value={selectedContact.district || ''} 
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, district: e.target.value }))}
                />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Area</span>
                <input 
                  type="text" 
                  className="drawer-input" 
                  value={selectedContact.area || ''} 
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, area: e.target.value }))}
                />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Account Status</span>
                <select 
                  className="drawer-input"
                  value={selectedContact.account_status || 'Active'}
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, account_status: e.target.value }))}
                >
                  <option value="Active">Active (Included in campaigns)</option>
                  <option value="Inactive">Inactive (Excluded from lists & stats)</option>
                </select>
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Assigned Volunteer</span>
                <select 
                  className="drawer-input"
                  value={selectedContact.assigned_to || 'Unassigned'}
                  onChange={(e) => setSelectedContact(prev => ({ ...prev, assigned_to: e.target.value }))}
                >
                  <option value="Unassigned">Unassigned</option>
                  {volunteers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
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

                <div className="drawer-field" style={{ gridColumn: 'span 2' }}>
                  <span className="drawer-label">SMS Campaign (Textbee)</span>
                  <select 
                    className="drawer-input"
                    value={selectedContact.sms_status || 'Pending'}
                    onChange={(e) => setSelectedContact(prev => ({ 
                      ...prev, 
                      sms_status: e.target.value,
                      sms_sent_date: e.target.value === 'Sent' ? getTodayString() : '' 
                    }))}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Sent">Sent</option>
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

      {/* ==================== BULK IMPORT / UPDATE MASTER CONTACTS MODAL ==================== */}
      {showMasterImportModal && (
        <div className="modal-backdrop" onClick={() => { setShowMasterImportModal(false); setMasterImportAnalysis(null); setMasterImportError(''); }}>
          <div className="modal" style={{ maxWidth: '840px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: 8, borderRadius: 8, color: '#818cf8', display: 'flex' }}>
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="drawer-title" style={{ margin: 0, fontSize: 18 }}>Bulk Import & Update Contacts</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Match contacts by <strong>AccCode</strong> and update available details without clearing empty fields
                  </p>
                </div>
              </div>
              <button className="close-btn" onClick={() => { setShowMasterImportModal(false); setMasterImportAnalysis(null); setMasterImportError(''); }}>
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {masterImportError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{masterImportError}</span>
              </div>
            )}

            {/* If No Analysis: Input & Upload Step */}
            {!masterImportAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 4, marginTop: 10 }}>
                
                {/* Step 1: Template Download Banner */}
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--color-text-white)', fontWeight: 600 }}>
                        📋 Step 1: Download Standard Template
                      </h4>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 480 }}>
                        Download our pre-formatted template with AccCode, Name, Phone, Email, District, Area, Emirate, Volunteer, and Sentiment columns.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => handleDownloadMasterTemplate('xlsx')}
                        style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                      >
                        <Download size={14} /> Download Excel (.xlsx)
                      </button>
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => handleDownloadMasterTemplate('csv')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                      >
                        <FileText size={14} /> Download CSV (.csv)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Upload or Paste Tabs */}
                <div>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 14 }}>
                    <button 
                      type="button"
                      className="btn"
                      style={{
                        background: masterImportTab === 'file' ? 'var(--bg-card)' : 'transparent',
                        border: '1px solid',
                        borderColor: masterImportTab === 'file' ? 'var(--border-color)' : 'transparent',
                        borderBottomColor: masterImportTab === 'file' ? 'var(--bg-modal)' : 'transparent',
                        borderRadius: '8px 8px 0 0',
                        padding: '8px 16px',
                        color: masterImportTab === 'file' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                        fontWeight: 600
                      }}
                      onClick={() => { setMasterImportTab('file'); setMasterImportError(''); }}
                    >
                      📁 Upload Spreadsheet (.xlsx, .csv)
                    </button>
                    <button 
                      type="button"
                      className="btn"
                      style={{
                        background: masterImportTab === 'paste' ? 'var(--bg-card)' : 'transparent',
                        border: '1px solid',
                        borderColor: masterImportTab === 'paste' ? 'var(--border-color)' : 'transparent',
                        borderBottomColor: masterImportTab === 'paste' ? 'var(--bg-modal)' : 'transparent',
                        borderRadius: '8px 8px 0 0',
                        padding: '8px 16px',
                        color: masterImportTab === 'paste' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                        fontWeight: 600
                      }}
                      onClick={() => { setMasterImportTab('paste'); setMasterImportError(''); }}
                    >
                      📋 Paste Excel / CSV Table
                    </button>
                  </div>

                  {masterImportTab === 'file' ? (
                    <div style={{ 
                      border: '2px dashed var(--border-color)', 
                      borderRadius: 12, 
                      padding: '36px 20px', 
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.01)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                        <Upload size={24} />
                      </div>
                      <div>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--color-text-white)' }}>
                          {masterImportFileName ? `Selected: ${masterImportFileName}` : 'Choose an Excel or CSV file to import'}
                        </h5>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          Supports .xlsx, .xls, .csv files with headers
                        </p>
                      </div>
                      <label className="btn primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Upload size={14} /> Browse File
                        <input 
                          type="file" 
                          accept=".xlsx,.xls,.csv,.txt" 
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleMasterFileSelect(file);
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Copy cells directly from Excel or Google Sheets (including header row) and paste below:
                      </p>
                      <textarea 
                        className="drawer-textarea"
                        placeholder={"AccCode\tAccountName\tMobile Number\tEmail ID\tDistrict\tArea\nL190\tMuhammed Rashid\t971501234567\trashid@example.com\tKOZHIKODE\tCITY\nL191\tPriya Nair\t0509876543\tpriya@example.com\tERNAKULAM\tALUVA"}
                        value={masterImportRawText}
                        onChange={(e) => { setMasterImportRawText(e.target.value); if (masterImportError) setMasterImportError(''); }}
                        style={{ height: '180px', fontFamily: 'monospace', fontSize: 12 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button 
                          type="button" 
                          className="btn primary" 
                          disabled={isAnalyzingMaster}
                          onClick={handleAnalyzePastedMasterText}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          {isAnalyzingMaster ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
                          Analyze Pasted Table
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 3: Analysis & Preview Results */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4, maxHeight: '72vh' }}>
                
                {/* Summary Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total In File</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-white)' }}>{masterImportAnalysis.totalRawCount}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Matched & Changing</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{masterImportAnalysis.hasChangesCount}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>New Contacts</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>{masterImportAnalysis.newRows.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Unchanged / Same</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-muted)' }}>{masterImportAnalysis.unchangedCount}</div>
                  </div>
                </div>

                {/* Options Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-white)', fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      checked={masterInsertNew}
                      onChange={(e) => setMasterInsertNew(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                    />
                    Insert as new contact if AccCode is not found in database ({masterImportAnalysis.newRows.length} new)
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <strong>{masterSelectedAccCodes.length}</strong> selected for import
                  </div>
                </div>

                {/* Preview Table */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead style={{ background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', width: 36 }}>
                            <input 
                              type="checkbox" 
                              checked={masterSelectedAccCodes.length === masterImportAnalysis.allActionable.length && masterImportAnalysis.allActionable.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMasterSelectedAccCodes(masterImportAnalysis.allActionable.map(r => r.accCode));
                                } else {
                                  setMasterSelectedAccCodes([]);
                                }
                              }}
                              style={{ accentColor: '#6366f1' }}
                            />
                          </th>
                          <th style={{ padding: '8px 12px' }}>AccCode</th>
                          <th style={{ padding: '8px 12px' }}>Account Name</th>
                          <th style={{ padding: '8px 12px' }}>Action</th>
                          <th style={{ padding: '8px 12px' }}>Fields to Update / Insert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterImportAnalysis.allActionable.map((item, idx) => {
                          const isSelected = masterSelectedAccCodes.includes(item.accCode);
                          return (
                            <tr 
                              key={item.accCode + '_' + idx}
                              style={{ 
                                borderBottom: '1px solid var(--border-color)', 
                                background: isSelected ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                                opacity: (!item.isNew || masterInsertNew) ? 1 : 0.4
                              }}
                            >
                              <td style={{ padding: '8px 12px' }}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setMasterSelectedAccCodes(prev => [...prev, item.accCode]);
                                    } else {
                                      setMasterSelectedAccCodes(prev => prev.filter(code => code !== item.accCode));
                                    }
                                  }}
                                  style={{ accentColor: '#6366f1' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-white)' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                  {item.accCode}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                                {item.name}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {item.isNew ? (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 600 }}>
                                    + New Contact
                                  </span>
                                ) : item.changes.length > 0 ? (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                                    ✓ Update
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-muted)' }}>
                                    Unchanged
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {item.changes.map((ch, cidx) => (
                                    <span 
                                      key={cidx} 
                                      style={{ 
                                        fontSize: 10, 
                                        padding: '2px 6px', 
                                        borderRadius: 4, 
                                        background: item.isNew ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                                        color: item.isNew ? '#818cf8' : '#fbbf24',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                      }}
                                      title={`${ch.field}: "${ch.oldVal}" -> "${ch.newVal}"`}
                                    >
                                      {ch.field}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => { setMasterImportAnalysis(null); setMasterImportError(''); }}
                  >
                    ← Back to File / Upload
                  </button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => { setShowMasterImportModal(false); setMasterImportAnalysis(null); setMasterImportError(''); }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn primary" 
                      disabled={isExecutingMaster || masterSelectedAccCodes.length === 0}
                      onClick={handleExecuteMasterImport}
                      style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {isExecutingMaster ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
                      {isExecutingMaster ? 'Importing...' : `Apply Updates (${masterSelectedAccCodes.length} contacts)`}
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            <div className="drawer-field">
              <span className="drawer-label">District</span>
              <input 
                type="text" 
                className="drawer-input" 
                placeholder="e.g. Kozhikode"
                value={newContact.district || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, district: e.target.value }))}
              />
            </div>

            <div className="drawer-field">
              <span className="drawer-label">Area</span>
              <input 
                type="text" 
                className="drawer-input" 
                placeholder="e.g. Muttada"
                value={newContact.area || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, area: e.target.value }))}
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
              Opening WhatsApp for <strong>{waConfirmContact.account_name}</strong> ({waConfirmContact.mobile_number}). 
              What was the outcome?
            </p>

            {/* Clipboard and Media Support Notification */}
            <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={15} /> Message & Emojis Ready
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isPhotoEnabled && (
                    <button 
                      type="button"
                      className="btn" 
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => copyPhotoToClipboard()}
                      title="Copy photo directly to clipboard so you can press Ctrl+V into WhatsApp"
                    >
                      <ImageIcon size={12} color="#10b981" /> Copy Photo (Ctrl+V)
                    </button>
                  )}
                  <button 
                    type="button"
                    className="btn" 
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => copyMessageToClipboard(waConfirmContact)}
                  >
                    <Copy size={12} /> {copiedContactId === waConfirmContact.id ? 'Copied!' : 'Copy Text'}
                  </button>
                </div>
              </div>

              {/* Poster Notice & Action Block */}
              {isPhotoEnabled && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: 'var(--color-bg-primary)', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                  <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '2px solid #10b981', flexShrink: 0, background: '#000' }}>
                    <img src={templatePhoto} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {(templatePhoto.startsWith('data:') || (customFlyerData && templatePhoto === customFlyerData)) && (
                      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,185,129,0.92)', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center', padding: '1px 0', letterSpacing: '0.5px' }}>
                        CUSTOM
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#10b981', fontSize: 13, marginBottom: 2 }}>
                      📷 Campaign Poster Ready in Clipboard
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
                      WhatsApp Web links cannot attach images automatically due to WhatsApp security.
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--color-text-white)', fontSize: 11 }}>
                      👉 In WhatsApp Web, simply press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', color: '#34d399' }}>Ctrl + V</kbd> to paste the poster!
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'pre-line', maxHeight: 80, overflowY: 'auto', background: 'var(--color-bg-primary)', padding: 8, borderRadius: 4, border: '1px solid var(--border-color)' }}>
                {formatTemplateMessage(templates.whatsapp, waConfirmContact)}
              </div>

              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                {isPhotoEnabled ? (
                  <span>💡 <em>To attach poster: Press <strong>Ctrl+V</strong> in WhatsApp Web. To re-copy text, click 'Copy Text'.</em></span>
                ) : (
                  <span>💡 <em>Tip: If WhatsApp Web displays any emoji as '?', simply press <strong>Ctrl+V</strong> in the chat input to paste the exact emoji message!</em></span>
                )}
              </div>
            </div>

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

      {/* ==================== BULK POSTER SENDING GUIDE MODAL ==================== */}
      {showBulkPhotoGuide && (
        <div className="modal-backdrop" onClick={() => setShowBulkPhotoGuide(false)}>
          <div className="modal" style={{ maxWidth: '580px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon color="#10b981" /> How to Send Poster in WhatsApp Messages
              </h3>
              <button className="close-btn" onClick={() => setShowBulkPhotoGuide(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontWeight: 600, color: '#10b981', marginBottom: 4, fontSize: 14 }}>
                  Why didn't the poster attach automatically?
                </div>
                <div>
                  WhatsApp's official web/mobile links (Click-to-Chat) <strong>only permit pre-filling text</strong>. WhatsApp strictly blocks all websites on the internet from attaching local image files directly via URL for privacy and security.
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'var(--color-bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-white)', marginBottom: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🚀 Method 1: Using your Bulk WhatsApp App (Recommended for All Voters)</span>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12 }}>
                  <li>Click <strong>Download Poster</strong> in our app toolbar to save the poster file (<code>AnilKumar_Campaign_Poster.jpg</code>) on your PC.</li>
                  <li>Click <strong>Export for Bulk App (.xlsx)</strong> to download your contact list with all personalized voter messages.</li>
                  <li>In your <strong>Bulk WhatsApp Software</strong> (e.g. WA Sender, Bulk WhatsApp Sender):
                    <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                      <li>Click the <strong>"Attach File / Media"</strong> button and select <code>AnilKumar_Campaign_Poster.jpg</code>.</li>
                      <li>Import the <code>.xlsx</code> file.</li>
                      <li>Click <strong>Send / Start Campaign</strong>.</li>
                    </ul>
                  </li>
                  <li style={{ color: '#10b981', fontWeight: 600, marginTop: 4 }}>The bulk app will dispatch the poster image with the personalized message caption to every voter!</li>
                </ol>
              </div>

              <div style={{ padding: '14px 16px', background: 'var(--color-bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-white)', marginBottom: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡ Method 2: In WhatsApp Web (Click-to-Chat)</span>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12 }}>
                  <li>Click <strong>Send Message</strong> next to any contact (our app automatically copies the poster to your clipboard).</li>
                  <li>When WhatsApp Web opens, simply press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>Ctrl + V</kbd>. The poster pops up instantly!</li>
                  <li>Add/confirm the caption and press Send.</li>
                </ol>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn primary" style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => downloadCampaignPhoto()}>
                <Download size={14} /> Download Poster File
              </button>
              <button type="button" className="btn" onClick={() => setShowBulkPhotoGuide(false)}>Close Guide</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WHATSAPP BULK NUMBERS IMPORT MODAL ==================== */}
      {showWaImportModal && (
        <div className="modal-backdrop" onClick={() => { setShowWaImportModal(false); setWaImportAnalysis(null); setWaImportRawText(''); setWaImportError(''); }}>
          <div className="modal" style={{ maxWidth: '750px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={20} color="#10b981" /> Import Numbers from Bulk WhatsApp App
              </h3>
              <button className="close-btn" onClick={() => { setShowWaImportModal(false); setWaImportAnalysis(null); setWaImportRawText(''); setWaImportError(''); }}><X size={20} /></button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '1px', marginBottom: 16 }}>
              <button 
                type="button"
                className="btn" 
                style={{ 
                  background: waImportTab === 'sent' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid',
                  borderColor: waImportTab === 'sent' ? 'var(--border-color)' : 'transparent',
                  borderBottomColor: waImportTab === 'sent' ? 'var(--bg-modal)' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '10px 20px',
                  color: waImportTab === 'sent' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => { setWaImportTab('sent'); setWaImportStatus('Sent'); setWaImportAnalysis(null); setWaImportError(''); }}
              >
                📥 Import Sent Numbers
              </button>
              <button 
                type="button"
                className="btn" 
                style={{ 
                  background: waImportTab === 'failed' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid',
                  borderColor: waImportTab === 'failed' ? 'var(--border-color)' : 'transparent',
                  borderBottomColor: waImportTab === 'failed' ? 'var(--bg-modal)' : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '10px 20px',
                  color: waImportTab === 'failed' ? 'var(--color-text-white)' : 'var(--color-text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => { setWaImportTab('failed'); setWaImportStatus('Failed'); setWaImportAnalysis(null); setWaImportError(''); }}
              >
                ⚠️ Import Failed / No WhatsApp Numbers
              </button>
            </div>

            {/* Modal Content */}
            {!waImportAnalysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {waImportTab === 'sent' ? (
                    "Copy and paste phone numbers you sent messages to from your bulk WhatsApp sender software (or copy an Excel column / delivery log). Numbers will be automatically matched to voters in your database."
                  ) : (
                    "Copy and paste numbers that failed, bounced, or don't have WhatsApp accounts from your bulk sender report. These contacts will be marked as 'Failed'."
                  )}
                </p>

                {/* Inline Error Message */}
                {waImportError && (
                  <div style={{ 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    color: '#f87171', 
                    padding: '10px 14px', 
                    borderRadius: 8, 
                    fontSize: 13, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8 
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{waImportError}</span>
                  </div>
                )}

                {/* Status, Date and Sentiment controls */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                      Set WhatsApp Status:
                    </label>
                    <select 
                      className="filter-select"
                      style={{ width: '100%' }}
                      value={waImportStatus}
                      onChange={(e) => setWaImportStatus(e.target.value)}
                    >
                      <option value="Sent">Sent</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Failed">Failed / No WhatsApp</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                      Sent Date:
                    </label>
                    <input 
                      type="date"
                      className="filter-select"
                      style={{ width: '100%' }}
                      value={waImportDate}
                      onChange={(e) => setWaImportDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                      Optional Voter Sentiment:
                    </label>
                    <select 
                      className="filter-select"
                      style={{ width: '100%' }}
                      value={waImportSentiment}
                      onChange={(e) => setWaImportSentiment(e.target.value)}
                    >
                      <option value="">(Keep Existing Sentiment)</option>
                      <option value="Strong Support (Panel)">🟢 Strong Support (Panel)</option>
                      <option value="Leaning Support (Anil Kumar only)">🟡 Leaning Support (Anil Kumar only)</option>
                      <option value="Undecided / Needs Follow-up">🟠 Undecided / Needs Follow-up</option>
                      <option value="Opposed">🔴 Opposed</option>
                      <option value="Unknown">Unknown / Uncontacted</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Paste Phone Numbers or Logs:
                  </label>
                  <label 
                    className="btn" 
                    style={{ 
                      fontSize: 11, 
                      padding: '4px 10px', 
                      cursor: 'pointer', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 4 
                    }}
                  >
                    <FileText size={12} /> Load from .txt / .csv file
                    <input 
                      type="file" 
                      accept=".txt,.csv" 
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setWaImportRawText(event.target?.result || '');
                            setWaImportError('');
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <textarea 
                  className="drawer-textarea" 
                  placeholder={"Paste numbers here (one per line, comma-separated, space-separated, or from Excel logs):\n\nExample:\n971506464369\n0504817685\n+971 50 632 4580\n050-646-7801\n506320994"}
                  value={waImportRawText}
                  onChange={(e) => {
                    setWaImportRawText(e.target.value);
                    if (waImportError) setWaImportError('');
                  }}
                  style={{ height: '200px', fontFamily: 'monospace', fontSize: 12 }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
                  <button 
                    type="button"
                    className="btn" 
                    onClick={() => { setShowWaImportModal(false); setWaImportRawText(''); setWaImportAnalysis(null); setWaImportError(''); }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="btn primary" 
                    disabled={isAnalyzingWa}
                    style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isAnalyzingWa ? 0.7 : 1 }}
                    onClick={handleAnalyzeWaImport}
                  >
                    {isAnalyzingWa ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
                    {isAnalyzingWa ? 'Analyzing...' : 'Analyze & Match Numbers'}
                  </button>
                </div>
              </div>
            ) : (
              // Analysis Results view
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4, maxHeight: '72vh' }}>
                
                {/* Result Statistics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total Numbers</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-white)' }}>{waImportAnalysis.numbersParsedCount}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Matched Contacts</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{waImportAnalysis.matchedContacts.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Selected to Update</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>{waSelectedMatchIds.length}</div>
                  </div>
                  <div className="stat-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Unmatched</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: (waImportAnalysis.unmatchedNumbers?.length || 0) > 0 ? '#f87171' : 'var(--color-text-muted)' }}>
                      {waImportAnalysis.unmatchedNumbers?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Match Banner */}
                {waImportAnalysis.matchedContacts.length === 0 ? (
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: 12, borderRadius: 8, fontSize: 13, color: '#f87171', alignItems: 'center' }}>
                    <AlertCircle size={18} /> No matching phone numbers found in your database. Please check the pasted values.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: 12, borderRadius: 8, fontSize: 13, color: '#34d399', alignItems: 'center' }}>
                    <CheckCircle size={18} /> Ready to update <strong>{waSelectedMatchIds.length}</strong> matching contacts to WhatsApp status: <strong>{waImportStatus || 'Sent'}</strong> (Date: {waImportDate || 'Today'}).
                  </div>
                )}

                {/* Unmatched list preview (if any) */}
                {(waImportAnalysis.unmatchedNumbers?.length || 0) > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#f87171' }}>
                        Unmatched Numbers ({waImportAnalysis.unmatchedNumbers.length} not found in database):
                      </span>
                      <button 
                        type="button"
                        className="btn" 
                        style={{ padding: '2px 8px', fontSize: 10 }}
                        onClick={() => {
                          if (navigator?.clipboard?.writeText) {
                            navigator.clipboard.writeText(waImportAnalysis.unmatchedNumbers.join('\n')).catch(() => {});
                          }
                          alert('Copied unmatched numbers to clipboard.');
                        }}
                      >
                        Copy Unmatched
                      </button>
                    </div>
                    <div style={{ maxHeight: '70px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', padding: 8, borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#fca5a5' }}>
                      {waImportAnalysis.unmatchedNumbers.join(', ')}
                    </div>
                  </div>
                )}

                {/* Matched Contacts List Table Preview */}
                {waImportAnalysis.matchedContacts.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        Matched Voters Preview ({waImportAnalysis.matchedContacts.length}):
                      </span>
                      <button 
                        type="button"
                        className="btn" 
                        style={{ padding: '2px 8px', fontSize: 10 }}
                        onClick={() => {
                          if (waSelectedMatchIds.length === waImportAnalysis.matchedContacts.length) {
                            setWaSelectedMatchIds([]);
                          } else {
                            setWaSelectedMatchIds(waImportAnalysis.matchedContacts.map(c => c.id));
                          }
                        }}
                      >
                        {waSelectedMatchIds.length === waImportAnalysis.matchedContacts.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                      <table className="contacts-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 30 }}>
                              <input 
                                type="checkbox" 
                                checked={waSelectedMatchIds.length > 0 && waSelectedMatchIds.length === waImportAnalysis.matchedContacts.length}
                                onChange={(e) => {
                                  if (e.target.checked) setWaSelectedMatchIds(waImportAnalysis.matchedContacts.map(c => c.id));
                                  else setWaSelectedMatchIds([]);
                                }}
                              />
                            </th>
                            <th>S.No</th>
                            <th>Code</th>
                            <th>Voter Name</th>
                            <th>Mobile Number</th>
                            <th>Current Status</th>
                            <th>New Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {waImportAnalysis.matchedContacts.map(c => (
                            <tr key={c.id}>
                              <td>
                                <input 
                                  type="checkbox" 
                                  checked={waSelectedMatchIds.includes(c.id)}
                                  onChange={() => {
                                    setWaSelectedMatchIds(prev => 
                                      prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                    );
                                  }}
                                />
                              </td>
                              <td>{c.s_no}</td>
                              <td>{c.acc_code}</td>
                              <td style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{c.account_name}</td>
                              <td>{c.mobile_number}</td>
                              <td>
                                <span className={`status-badge ${(c.whatsapp_status || 'pending').toLowerCase()}`}>
                                  {c.whatsapp_status || 'Pending'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${(waImportStatus || 'Sent').toLowerCase()}`} style={{ fontWeight: 700 }}>
                                  → {waImportStatus || 'Sent'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => { setWaImportAnalysis(null); setWaImportError(''); }}
                  >
                    ← Back to Paste
                  </button>
                  <button 
                    type="button"
                    className="btn success" 
                    disabled={waSelectedMatchIds.length === 0}
                    style={{ background: '#10b981', borderColor: '#10b981' }}
                    onClick={handleExecuteWaImport}
                  >
                    ✓ Apply Updates to Database ({waSelectedMatchIds.length})
                  </button>
                </div>
              </div>
            )}
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
      {/* ==================== VOLUNTEER MANAGEMENT MODAL ==================== */}
      {showVolunteerModal && (
        <div className="modal-backdrop" onClick={() => { setShowVolunteerModal(false); }}>
          <div className="modal" style={{ maxWidth: '500px', width: '95%', background: 'var(--bg-modal)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={20} color="#fbbf24" /> Manage Campaign Volunteers
              </h3>
              <button className="close-btn" onClick={() => { setShowVolunteerModal(false); }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Add Volunteer Form */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  className="drawer-input" 
                  placeholder="Enter volunteer's name (e.g. Suresh Kumar)..." 
                  value={newVolunteerName}
                  onChange={(e) => setNewVolunteerName(e.target.value)}
                  style={{ margin: 0, height: 40 }}
                />
                <button className="btn success" onClick={handleAddVolunteer} style={{ height: 40, whiteSpace: 'nowrap' }}>
                  <Plus size={16} /> Add Helper
                </button>
              </div>

              {/* Volunteers List */}
              <div>
                <h4 style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>Registered Volunteers ({volunteers.length})</h4>
                <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 4 }}>
                  {volunteers.length > 0 ? (
                    volunteers.map((name) => (
                      <div 
                        key={name} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '10px 12px', 
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: 4
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--color-text-white)' }}>{name}</span>
                        <button 
                          onClick={() => handleDeleteVolunteer(name)} 
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove Volunteer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      No volunteers registered yet. Add one above!
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <button className="btn" onClick={() => setShowVolunteerModal(false)}>
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SMS INBOX / REPLIES MODAL ==================== */}
      {showSmsInboxModal && (
        <div className="modal-backdrop" onClick={() => setShowSmsInboxModal(false)}>
          <div className="modal" style={{ maxWidth: 680, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Inbox size={20} color="#3b82f6" />
                <h3 className="drawer-title" style={{ margin: 0 }}>Voter SMS Inbox & Replies</h3>
                <span style={{ fontSize: 12, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                  {incomingSmsList.length} Messages
                </span>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowSmsInboxModal(false)}>×</button>
            </div>

            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Webhook Configuration Guide Banner */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--color-text-white)' }}>Textbee Webhook Endpoint:</strong>
                  <span style={{ color: textbeeConfig.hasWebhookSecret ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {textbeeConfig.hasWebhookSecret ? '✓ HMAC Signature Verified' : '⚠ Secret Not Set in .env'}
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 4, color: '#38bdf8', wordBreak: 'break-all' }}>
                  POST {window.location.origin}/api/sms/webhook
                </div>
                <div style={{ color: 'var(--color-text-muted)', marginTop: 6, fontSize: 11 }}>
                  Set this URL in your Textbee Dashboard Webhooks with event <code>MESSAGE_RECEIVED</code>. Replies automatically sync into voter notes.
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Recent Incoming Messages:</span>
                <button 
                  className="btn" 
                  onClick={fetchIncomingSms}
                  style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {/* Messages List */}
              <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {incomingSmsList.length > 0 ? (
                  incomingSmsList.map((msg) => {
                    const matchedContact = msg.contact_id ? contacts.find(c => c.id === msg.contact_id) : null;
                    return (
                      <div 
                        key={msg.id} 
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '12px 16px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 14, color: 'var(--color-text-white)' }}>
                              {msg.contact_name && msg.contact_name !== 'Unknown' ? msg.contact_name : msg.sender}
                            </strong>
                            {msg.sender && (
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                ({msg.sender})
                              </span>
                            )}
                            {matchedContact && (
                              <button 
                                className="action-btn"
                                style={{ padding: '2px 6px', fontSize: 11, height: 'auto' }}
                                title="Open Contact Details"
                                onClick={() => { setShowSmsInboxModal(false); handleOpenDrawer(matchedContact); }}
                              >
                                View Contact
                              </button>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {msg.received_at ? new Date(msg.received_at).toLocaleString() : (msg.created_at || '')}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: 6 }}>
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    No incoming SMS messages received yet. When voters reply to your SMS broadcast, their messages will appear here.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <button className="btn" onClick={() => setShowSmsInboxModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating SMS Broadcast Progress Toast */}
      {smsBroadcastProgress?.active && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          minWidth: 320,
          maxWidth: 400
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={18} color="#f59e0b" />
              <strong style={{ fontSize: 14, color: 'var(--color-text-white)' }}>Android SMS Broadcast</strong>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {smsBroadcastProgress.current} / {smsBroadcastProgress.total}
            </span>
          </div>
          
          <div className="target-progress-bar-container" style={{ height: 6, margin: '8px 0', background: 'rgba(255,255,255,0.1)' }}>
            <div 
              className="target-progress-bar" 
              style={{ 
                width: `${smsBroadcastProgress.total > 0 ? (smsBroadcastProgress.current / smsBroadcastProgress.total) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #f59e0b, #10b981)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
              {smsBroadcastProgress.currentName ? `Sending: ${smsBroadcastProgress.currentName}` : 'Preparing...'}
            </span>
            <span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {smsBroadcastProgress.success}</span>
              {smsBroadcastProgress.failed > 0 && <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 600 }}>✗ {smsBroadcastProgress.failed}</span>}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, fontStyle: 'italic' }}>
            Carrier pacing active (2s delay per SMS)
          </div>
        </div>
      )}

    </div>
  );
}

function varColorTextMuted() {
  return 'var(--color-text-muted)';
}
