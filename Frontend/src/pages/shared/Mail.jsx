import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronRight,
  Edit3,
  FileText,
  Inbox,
  MailCheck,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import styles from "./Mail.module.css";

const initialMessages = [
  {
    id: 1,
    sender: "Dr. Sarah Jenkins",
    role: "Cardiologist",
    subject: "Your recent lab results",
    time: "10:42 AM",
    unread: true,
    starred: true,
    folder: "inbox",
    snippet: "The CBC results are available. I have reviewed the report and added my notes.",
  },
  {
    id: 2,
    sender: "Care Coordination",
    role: "MediKiosk Clinic",
    subject: "Appointment reminder",
    time: "Yesterday",
    unread: true,
    starred: false,
    folder: "inbox",
    snippet: "A reminder for your upcoming consultation scheduled for October 15.",
  },
  {
    id: 3,
    sender: "MediKiosk Support",
    role: "Patient Services",
    subject: "Your health record was updated",
    time: "Oct 02",
    unread: false,
    starred: false,
    folder: "inbox",
    snippet: "A new document has been added securely to your personal health record.",
  },
  {
    id: 4,
    sender: "Dr. Rohan Mehta",
    role: "Dermatologist",
    subject: "Follow-up details",
    time: "Sep 28",
    unread: false,
    starred: false,
    folder: "sent",
    snippet: "Thank you for sharing the requested details before your follow-up.",
  },
];

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "archive", label: "Archive", icon: Archive },
];

const getInitials = (name) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");

export default function Mail() {
  const [messages, setMessages] = useState(initialMessages);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [activeId, setActiveId] = useState(1);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);

  const folderCounts = useMemo(() => ({
    inbox: messages.filter((message) => message.folder === "inbox" && message.unread).length,
    starred: messages.filter((message) => message.starred).length,
    sent: messages.filter((message) => message.folder === "sent").length,
    drafts: 1,
    archive: 0,
  }), [messages]);

  const visibleMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return messages.filter((message) => {
      const inFolder = activeFolder === "starred" ? message.starred : message.folder === activeFolder;
      const matchesQuery = !normalizedQuery || `${message.sender} ${message.subject} ${message.snippet}`.toLowerCase().includes(normalizedQuery);
      return inFolder && matchesQuery;
    });
  }, [activeFolder, messages, query]);

  const selected = messages.find((message) => message.id === activeId) || visibleMessages[0];

  const chooseMessage = (message) => {
    setActiveId(message.id);
    setMobileReaderOpen(true);
    setReplySent(false);
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, unread: false } : item));
  };

  const chooseFolder = (folder) => {
    setActiveFolder(folder);
    setQuery("");
    setMobileReaderOpen(false);
    const firstMessage = messages.find((message) => folder === "starred" ? message.starred : message.folder === folder);
    if (firstMessage) setActiveId(firstMessage.id);
  };

  const sendReply = (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setReply("");
    setReplySent(true);
    window.setTimeout(() => setReplySent(false), 2500);
  };

  return (
    <motion.main className={`${styles.page} workspacePage`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <header className={styles.hero}>
        <div>
          <span>Secure communications</span>
          <h1>Messages</h1>
          <p>Private conversations with your care team and MediKiosk services.</p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <span><MailCheck /></span>
          <i /><i /><i />
        </div>
        <button className={styles.composeButton} onClick={() => setComposeOpen(true)}><Edit3 /> Compose message</button>
      </header>

      <div className={styles.mailLayout}>
        <aside className={styles.folders}>
          <div className={styles.folderTitle}>Mailbox</div>
          {folders.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeFolder === id ? styles.activeFolder : ""} onClick={() => chooseFolder(id)}>
              <Icon />
              <span>{label}</span>
              {folderCounts[id] > 0 && <b>{folderCounts[id]}</b>}
            </button>
          ))}
          <div className={styles.privacyNote}><ShieldCheck /><div><strong>Your messages are private</strong><span>Secure communication with your care team.</span></div></div>
        </aside>

        <section className={styles.mailbox}>
          <div className={styles.mailboxHeader}>
            <div><h2>{folders.find((folder) => folder.id === activeFolder)?.label}</h2><p>{visibleMessages.length} {visibleMessages.length === 1 ? "conversation" : "conversations"}</p></div>
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" /></label>
          </div>

          <div className={styles.columns}>
            <div className={`${styles.messageList} ${mobileReaderOpen ? styles.mobileHidden : ""}`}>
              {visibleMessages.length ? visibleMessages.map((message) => (
                <button key={message.id} className={`${styles.message} ${message.id === activeId ? styles.selectedMessage : ""}`} onClick={() => chooseMessage(message)}>
                  <span className={styles.avatar}>{getInitials(message.sender)}</span>
                  <span className={styles.messageCopy}>
                    <span className={styles.senderLine}><strong>{message.sender}</strong><time>{message.time}</time></span>
                    <b>{message.subject}</b>
                    <small>{message.snippet}</small>
                  </span>
                  {message.unread && <i className={styles.unreadDot} />}
                </button>
              )) : (
                <div className={styles.emptyList}><MailCheck /><strong>No messages here</strong><span>{query ? "Try a different search." : `Your ${activeFolder} messages will appear here.`}</span></div>
              )}
            </div>

            <article className={`${styles.reader} ${mobileReaderOpen ? styles.mobileReaderOpen : ""}`}>
              {selected && visibleMessages.some((message) => message.id === selected.id) ? (
                <>
                  <header className={styles.readerHeader}>
                    <button className={styles.backButton} onClick={() => setMobileReaderOpen(false)} aria-label="Back to message list"><ArrowLeft /></button>
                    <span className={styles.avatar}>{getInitials(selected.sender)}</span>
                    <div><h2>{selected.subject}</h2><p>From {selected.sender} · {selected.role} · {selected.time}</p></div>
                    <button className={styles.moreButton} aria-label="More message options"><MoreHorizontal /></button>
                  </header>
                  <div className={styles.readerBody}>
                    <p>Hello,</p>
                    <p>{selected.snippet}</p>
                    <p>You can reply directly if you have questions or need support before your next visit.</p>
                    <strong>MediKiosk Care Team</strong>
                    <small>This is a secure message related to your healthcare.</small>
                  </div>
                  <form className={styles.replyBox} onSubmit={sendReply}>
                    <button type="button" aria-label="Attach a file"><Paperclip /></button>
                    <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a secure reply…" />
                    <button type="submit" className={styles.sendButton} disabled={!reply.trim()}>{replySent ? <Check /> : <Send />}<span>{replySent ? "Sent" : "Send reply"}</span></button>
                  </form>
                </>
              ) : (
                <div className={styles.emptyReader}><div><MailCheck /></div><h2>Select a conversation</h2><p>Choose a message to read it securely.</p></div>
              )}
            </article>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {composeOpen && (
          <motion.div className={styles.modalBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setComposeOpen(false)}>
            <motion.form className={styles.composeModal} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); setComposeOpen(false); }}>
              <header><div><span>Secure message</span><h2>New conversation</h2></div><button type="button" onClick={() => setComposeOpen(false)} aria-label="Close compose message"><X /></button></header>
              <label>To<select defaultValue=""><option value="" disabled>Select your care team</option><option>Care Coordination</option><option>MediKiosk Support</option><option>Dr. Sarah Jenkins</option></select></label>
              <label>Subject<input placeholder="What is this regarding?" /></label>
              <label>Message<textarea placeholder="Write your message…" rows="6" /></label>
              <footer><button type="button" className={styles.cancelButton} onClick={() => setComposeOpen(false)}>Cancel</button><button className={styles.modalSend}><Send /> Send securely</button></footer>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
