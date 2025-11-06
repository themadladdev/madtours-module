// client/src/adminPortal/MADTourManagement/TicketManager/TicketManager.jsx
import React, { useState, useEffect } from 'react';
import * as adminTicketService from '../../../services/admin/adminTicketService.js';
import ConfirmationDialog from '../../../ui/dialogbox/ConfirmationDialog.jsx';
import TicketEditorModal from './TicketEditorModal.jsx';
import styles from './TicketManager.module.css';
import sharedStyles from '../../adminshared.module.css';

const TicketManager = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const allTickets = await adminTicketService.getAllTicketDefinitions();
      setTickets(allTickets);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = (type) => {
    // We pass a 'stub' object to the modal
    setSelectedTicket({ name: 'New Ticket', type: type });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (e, ticket) => {
    e.stopPropagation();
    setShowDeleteConfirm(ticket);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTicket(null);
  };

  const handleSaveSuccess = (message) => {
    handleModalClose();
    loadTickets();
    setToast({ type: 'success', message });
  };

  const handleSaveError = (message) => {
    setToast({ type: 'error', message });
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;
    setToast(null);
    try {
      await adminTicketService.deleteTicketDefinition(showDeleteConfirm.id);
      loadTickets();
      setToast({ type: 'success', message: `Ticket "${showDeleteConfirm.name}" deleted.` });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const atomicTickets = tickets.filter(t => t.type === 'atomic');
  const combinedTickets = tickets.filter(t => t.type === 'combined');

  const renderTable = (data) => (
    <table className={sharedStyles.table}>
      <thead>
        <tr>
          <th>Ticket Name</th>
          <th className={styles.actionsCell}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan="2" style={{ textAlign: 'center', padding: '2rem' }}>
              No tickets of this type found.
            </td>
          </tr>
        ) : (
          data.map(ticket => (
            <tr key={ticket.id} className={styles.ticketRow} onClick={() => handleOpenEdit(ticket)}>
              <td className={styles.ticketName}>{ticket.name}</td>
              <td className={styles.actionsCell}>
                <button
                  className={sharedStyles.destructiveGhostButtonSmall}
                  onClick={(e) => handleOpenDelete(e, ticket)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  // --- [NEW] Card List Renderer ---
  const renderCardList = (data) => (
    <>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          No tickets of this type found.
        </div>
      ) : (
        data.map(ticket => (
          <div 
            key={ticket.id} 
            className={styles.ticketCard}
            onClick={() => handleOpenEdit(ticket)}
          >
            <span className={styles.ticketName}>{ticket.name}</span>
            <button
              className={sharedStyles.destructiveGhostButtonSmall}
              onClick={(e) => handleOpenDelete(e, ticket)}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </>
  );

  return (
    <div className={styles.managerContainer}>
      {toast && (
        <div 
          className={sharedStyles.toastNotification}
          style={{ borderLeftColor: toast.type === 'error' ? 'var(--destructive)' : 'var(--text)' }}
        >
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)}>Close</button>
        </div>
      )}

      <div className={styles.header}>
        <h3>Ticket Library</h3>
        <div className={styles.buttonGroup}>
          <button 
            className={sharedStyles.primaryButton}
            onClick={() => handleOpenCreate('atomic')}
          >
            + New Atomic Ticket
          </button>
          <button 
            className={sharedStyles.secondaryButton}
            onClick={() => handleOpenCreate('combined')}
          >
            + New Combined Ticket
          </button>
        </div>
      </div>

      <h4 className={styles.tableHeading}>Atomic Tickets</h4>
      <p className={sharedStyles.description}>
        These are the base tickets (e.g., "Adult", "Child") that can be priced individually or used in a combined ticket.
      </p>
      <div className={sharedStyles.contentBox}>
        {loading ? (
          <div className={sharedStyles.loadingContainer}>
            <div className={sharedStyles.spinner}></div>
          </div>
        ) : (
          <>
            {/* --- [NEW] Desktop/Mobile Switch --- */}
            <div className={styles.desktopTable}>{renderTable(atomicTickets)}</div>
            <div className={styles.mobileCardList}>{renderCardList(atomicTickets)}</div>
          </>
        )}
      </div>

      <h4 className={styles.tableHeading}>Combined Tickets</h4>
      <p className={sharedStyles.description}>
        These are "bundle" tickets (e.g., "Family Pass") made up of multiple atomic tickets. They are priced as a single unit.
      </p>
      <div className={sharedStyles.contentBox}>
        {loading ? (
          <div className={sharedStyles.loadingContainer}>
            <div className={sharedStyles.spinner}></div>
          </div>
        ) : (
          <>
            {/* --- [NEW] Desktop/Mobile Switch --- */}
            <div className={styles.desktopTable}>{renderTable(combinedTickets)}</div>
            <div className={styles.mobileCardList}>{renderCardList(combinedTickets)}</div>
          </>
        )}
      </div>

      <TicketEditorModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        ticket={selectedTicket}
        atomicTickets={atomicTickets}
        onSaveSuccess={handleSaveSuccess}
        onSaveError={handleSaveError}
      />

      <ConfirmationDialog
        isOpen={!!showDeleteConfirm}
        title="Delete Ticket"
        message={`Are you sure you want to delete "${showDeleteConfirm?.name}"?\nThis will fail if the ticket is currently used in a combined ticket recipe or has a price set on any tour.`}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default TicketManager;