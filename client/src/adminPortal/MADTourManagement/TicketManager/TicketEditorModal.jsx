// client/src/adminPortal/MADTourManagement/TicketManager/TicketEditorModal.jsx
import React, { useState, useEffect } from 'react';
import AdminFormModal from '../../../ui/modals/AdminFormModal.jsx';
import * as adminTicketService from '../../../services/admin/adminTicketService.js';
import styles from './TicketEditorModal.module.css';
import sharedStyles from '../../adminshared.module.css';

// --- Recipe Editor Sub-component ---
const RecipeEditor = ({ recipe, atomicTickets, onRecipeChange }) => {
  const [newAtomicId, setNewAtomicId] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);

  const handleAddComponent = (e) => {
    e.preventDefault(); // Prevent any default browser action
    if (!newAtomicId || newQuantity <= 0) return;

    const ticket = atomicTickets.find(t => t.id === parseInt(newAtomicId));
    if (!ticket) return;

    // Check if it already exists to prevent duplicates
    const exists = recipe.find(item => item.atomic_ticket_id === ticket.id);
    if (exists) return;

    onRecipeChange([
      ...recipe,
      {
        atomic_ticket_id: ticket.id,
        quantity: newQuantity,
        atomic_ticket_name: ticket.name // Add name for display
      }
    ]);
    setNewAtomicId('');
    setNewQuantity(1);
  };

  const handleRemoveComponent = (atomicId) => {
    onRecipeChange(recipe.filter(item => item.atomic_ticket_id !== atomicId));
  };

  const handleQuantityChange = (atomicId, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    onRecipeChange(
      recipe.map(item =>
        item.atomic_ticket_id === atomicId ? { ...item, quantity: qty } : item
      )
    );
  };

  return (
    <div className={styles.recipeEditor}>
      <label className={sharedStyles.formGroup}>Recipe Components</label>
      {recipe.length === 0 ? (
        <p className={styles.noRecipe}>No components added yet.</p>
      ) : (
        <div className={styles.recipeList}>
          {recipe.map(item => (
            <div key={item.atomic_ticket_id} className={styles.recipeItem}>
              <span className={styles.recipeItemName}>{item.atomic_ticket_name}</span>
              <input
                type="number"
                min="1"
                step="1"
                className={styles.recipeQuantity}
                value={item.quantity}
                onChange={(e) => handleQuantityChange(item.atomic_ticket_id, e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemoveComponent(item.atomic_ticket_id)}
                className={styles.removeBtn}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --- FIX: Changed <form> to <div> --- */}
      <div className={styles.addComponentForm}>
        <select
          value={newAtomicId}
          onChange={(e) => setNewAtomicId(e.target.value)}
          className={sharedStyles.input}
        >
          <option value="">-- Select atomic ticket --</option>
          {atomicTickets.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          step="1"
          value={newQuantity}
          onChange={(e) => setNewQuantity(parseInt(e.target.value, 10))}
          className={sharedStyles.input}
          style={{ width: '80px' }}
        />
        {/* --- FIX: Changed type="submit" to type="button" and added onClick --- */}
        <button 
          type="button" 
          className={sharedStyles.secondaryButtonSmall}
          onClick={handleAddComponent}
        >
          Add
        </button>
      </div>
    </div>
  );
};

// --- Main Modal Component ---
const TicketEditorModal = ({ isOpen, onClose, ticket, atomicTickets, onSaveSuccess, onSaveError }) => {
  const [formData, setFormData] = useState({ name: '', type: 'atomic' });
  const [recipe, setRecipe] = useState([]);
  const [loading, setLoading] = useState(false);

  const isCreating = !ticket?.id;
  const modalTitle = isCreating ? 'Create New Ticket' : 'Edit Ticket';

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      if (ticket) {
        setFormData({
          name: ticket.name,
          type: ticket.type,
        });

        if (ticket.type === 'combined' && ticket.id) {
          // It's an existing combined ticket, fetch its recipe
          adminTicketService.getCombinedTicketRecipe(ticket.id)
            .then(data => setRecipe(data))
            .catch(err => onSaveError(`Failed to load recipe: ${err.message}`))
            .finally(() => setLoading(false));
        } else {
          // It's an atomic ticket or a new ticket
          setRecipe([]);
          setLoading(false);
        }
      }
    }
  }, [isOpen, ticket]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      let savedTicket;
      if (isCreating) {
        savedTicket = await adminTicketService.createTicketDefinition(formData);
      } else {
        savedTicket = await adminTicketService.updateTicketDefinition(ticket.id, formData);
      }
      
      // If it's a combined ticket, save the recipe
      if (formData.type === 'combined') {
        const recipeToSave = recipe.map(item => ({
          atomic_ticket_id: item.atomic_ticket_id,
          quantity: item.quantity
        }));
        await adminTicketService.setCombinedTicketRecipe(savedTicket.id, recipeToSave);
      }

      setLoading(false);
      onSaveSuccess(isCreating ? 'Ticket created!' : 'Ticket updated!');
      
    } catch (err) {
      setLoading(false);
      onSaveError(err.message || 'Failed to save ticket');
    }
  };

  return (
    <AdminFormModal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {loading ? (
        <div className={sharedStyles.loadingContainer}>
          <div className={sharedStyles.spinner}></div>
        </div>
      ) : (
        /* --- FIX: Changed <form> to <div> --- */
        <div>
          <div className={sharedStyles.formGroup}>
            <label>Ticket Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleFormChange} className={sharedStyles.input} />
          </div>
          <div className={sharedStyles.formGroup}>
            <label>Ticket Type</label>
            <select name="type" value={formData.type} onChange={handleFormChange} className={sharedStyles.input} disabled={!isCreating}>
              <option value="atomic">Atomic (e.g., Adult, Child)</option>
              <option value="combined">Combined (e.g., Family Pass)</option>
            </select>
          </div>

          {formData.type === 'combined' && (
            <RecipeEditor
              recipe={recipe}
              atomicTickets={atomicTickets}
              onRecipeChange={setRecipe}
            />
          )}
        </div>
      )}

      <div className={sharedStyles.formFooter}>
        <button 
          type="button" 
          className={sharedStyles.secondaryButton}
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          type="button" 
          className={sharedStyles.primaryButton}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AdminFormModal>
  );
};

export default TicketEditorModal;