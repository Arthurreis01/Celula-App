// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCa9GP0FT3TX-yHPNm4b6NX6LCe-TVNJWY",
  authDomain: "ocnc-celula.firebaseapp.com",
  projectId: "ocnc-celula",
  storageBucket: "ocnc-celula.firebasestorage.app",
  messagingSenderId: "937864564215",
  appId: "1:937864564215:web:2d6aaea1440280e64972f2",
  measurementId: "G-5NE4L7F36P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // Password Protection
  const password = "go05"; // Replace with your desired password
  let userPassword = prompt("Por favor, insira a senha para acessar o aplicativo:");
    if (userPassword !== password) {
      alert("Senha incorreta. Você não tem permissão para acessar este aplicativo.");
      window.location.href = "https://www.google.com"; // Redirect to another page or close the window
      return;
    }
  const prayerRequestsContainer = document.getElementById('prayer-requests-container');
  const answeredRequestsContainer = document.getElementById('answered-requests-container');
  const newRequestButton = document.getElementById('new-request-btn');
  const newCardForm = document.getElementById('new-card-form');
  const addCardBtn = document.getElementById('add-card-btn');
  let activeCard = null;

  // Variables to store unsubscribe functions for Firestore listeners
  let unsubscribePrayerRequests = null;
  let unsubscribeAnsweredRequests = null;

  // Event listeners for footer buttons
  const prayerRequestsBtn = document.getElementById('prayer-requests-btn');
  const prayerAnswersBtn = document.getElementById('prayer-answers-btn');
  const prayerSection = document.getElementById('prayer-section');
  const answeredSection = document.getElementById('answered-section');

  // Load prayer requests on page load
  loadPrayerRequests();

  prayerRequestsBtn.addEventListener('click', () => {
    prayerSection.style.display = 'block';
    answeredSection.style.display = 'none';
    prayerRequestsBtn.classList.add('active');
    prayerAnswersBtn.classList.remove('active');

    loadPrayerRequests(); // Load prayer requests

    // Unsubscribe from answered requests listener if active
    if (unsubscribeAnsweredRequests) {
      unsubscribeAnsweredRequests();
      unsubscribeAnsweredRequests = null;
    }
  });

  prayerAnswersBtn.addEventListener('click', () => {
    prayerSection.style.display = 'none';
    answeredSection.style.display = 'block';
    prayerRequestsBtn.classList.remove('active');
    prayerAnswersBtn.classList.add('active');

    loadAnsweredRequests(); // Load answered requests

    // Unsubscribe from prayer requests listener if active
    if (unsubscribePrayerRequests) {
      unsubscribePrayerRequests();
      unsubscribePrayerRequests = null;
    }
  });

  // Show the pop-up form when the "+" button is clicked
  newRequestButton.addEventListener('click', (event) => {
    event.stopPropagation();
    newCardForm.style.display = 'block';
  });

  // Close the new card form when clicking outside of it
  document.addEventListener('click', (event) => {
    const isClickInsideForm = newCardForm.contains(event.target);
    const isClickOnButton = newRequestButton.contains(event.target);

    if (!isClickInsideForm && !isClickOnButton) {
      newCardForm.style.display = 'none';
    }
  });

  // Add a new card when "Add Request" button is clicked
  addCardBtn.addEventListener('click', () => {
    const title = document.getElementById('new-title').value.trim();
    const summary = document.getElementById('new-summary').value.trim();
    const name = document.getElementById('new-name').value.trim();

    if (title && summary && name) {
      const newCard = {
        title: sanitizeInput(title),
        summary: sanitizeInput(summary),
        name: sanitizeInput(name),
        comments: [],
        answer: '',
        hasAnswer: false, // Added field
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      db.collection('prayerRequests').add(newCard)
        .then(() => {
          newCardForm.style.display = 'none'; // Hide the form
          clearFormFields(); // Clear form inputs
        })
        .catch((error) => {
          console.error('Error adding new card:', error);
          alert('Erro ao adicionar o pedido. Tente novamente.');
        });
    } else {
      alert('Por favor, preencha todos os campos.');
    }
  });

  // Function to create a smaller card
  function createSmallCard(title, summary, name, id) {
    const card = document.createElement('div');
    card.classList.add('small-card');
    card.innerHTML = `
      <h4 class="card-title">${title}</h4>
      <p class="card-name">${name}</p>
    `;

    // Initialize commentsData and answerData
    card.commentsData = [];
    card.answerData = '';
    card.cardId = id; // Store the card ID

    // Add event listener to the card for expansion
    card.addEventListener('click', () => expandCard(card, title, summary, name));

    return card;
  }

  // Function to expand the card and show full details
  function expandCard(card, title, summary, name) {
    card.classList.toggle('expanded-card');
    if (card.classList.contains('expanded-card')) {
      card.innerHTML = `
        <h4 class="card-title">${title}</h4>
        <p class="card-name">${name}</p>
        <div class="answer-field" style="display: none;">
          <p><strong>Resposta de Oração:</strong> <span></span></p>
        </div>
        <p class="card-summary">Resumo: ${summary}</p>
        <div class="card-actions">
          <button class="btn comment-btn"><i class="fas fa-comment"></i></button>
          <button class="btn answer-btn"><i class="fas fa-check"></i></button>
          <button class="btn edit-btn"><i class="fas fa-edit"></i></button>
          <button class="btn trash-btn"><i class="fas fa-trash"></i></button>
        </div>
        <div class="comments-section"></div>
        <div class="show-more-comments" style="display: none; cursor: pointer; color: #007bff;">Ver todos os comentários</div>
      `;

      // Attach event listeners to the buttons using event delegation
      card.querySelector('.card-actions').addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the card from collapsing when clicking a button
        const targetButton = event.target.closest('button');

        if (!targetButton) return; // Exit if no button was clicked

        if (targetButton.classList.contains('comment-btn')) {
          activeCard = card;
          $('#commentModal').modal('show');
        } else if (targetButton.classList.contains('answer-btn')) {
          activeCard = card;
          $('#answerModal').modal('show');
        } else if (targetButton.classList.contains('edit-btn')) {
          activeCard = card;
          openEditModal(card);
        } else if (targetButton.classList.contains('trash-btn')) {
          // Show custom delete confirmation modal
          activeCard = card;
          $('#deleteConfirmModal').modal('show');
        }
      });

      // Update comments display
      updateCommentsDisplay(card);

      // Load answer if any
      const cardId = card.cardId;
      db.collection('prayerRequests').doc(cardId).onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const answer = data.answer;
          if (answer) {
            const answerField = card.querySelector('.answer-field');
            answerField.style.display = 'block';
            answerField.querySelector('span').textContent = answer;
            card.answerData = answer;

            // Hide the answer button if the prayer is answered
            const answerBtn = card.querySelector('.answer-btn');
            if (answerBtn) {
              answerBtn.style.display = 'none';
            }
          }
        }
      });

    } else {
      // If collapsing the card, reset to small card view
      card.innerHTML = `
        <h4 class="card-title">${title}</h4>
        <p class="card-name">${name}</p>
      `;
    }
  }

  // Handle saving the answer
  document.getElementById('save-answer-btn').addEventListener('click', () => {
    if (activeCard) {
      const answerInput = document.getElementById('answer-input').value.trim();
      if (answerInput) {
        const cardId = activeCard.cardId;
        db.collection('prayerRequests').doc(cardId).update({
          answer: sanitizeInput(answerInput),
          hasAnswer: true // Update hasAnswer to true
        })
          .then(() => {
            $('#answerModal').modal('hide');
            document.getElementById('answer-input').value = ''; // Clear input
            activeCard = null;
            // The card will be moved via the onSnapshot listeners
          })
          .catch((error) => {
            console.error('Error saving answer:', error);
            alert('Erro ao salvar a resposta. Tente novamente.');
          });
      } else {
        alert('Por favor, insira uma resposta.');
      }
    }
  });

  // Handle saving the comment
  document.getElementById('save-comment-btn').addEventListener('click', () => {
    if (activeCard) {
      const commentName = document.getElementById('comment-name').value.trim();
      const commentInput = document.getElementById('comment-input').value.trim();
      if (commentName && commentInput) {
        const comment = {
          name: sanitizeInput(commentName),
          text: sanitizeInput(commentInput)
        };

        const cardId = activeCard.cardId;
        db.collection('prayerRequests').doc(cardId).update({
          comments: firebase.firestore.FieldValue.arrayUnion(comment)
        })
          .then(() => {
            $('#commentModal').modal('hide');
            document.getElementById('comment-name').value = ''; // Clear inputs
            document.getElementById('comment-input').value = ''; // Clear inputs
          })
          .catch((error) => {
            console.error('Error adding comment:', error);
            alert('Erro ao adicionar o comentário. Tente novamente.');
          });

      } else {
        alert('Por favor, preencha todos os campos do comentário.');
      }
    }
  });

  // Update comments display to show or hide "See all comments"
  function updateCommentsDisplay(card) {
    const commentsSection = card.querySelector('.comments-section');
    const showMoreComments = card.querySelector('.show-more-comments');
    const cardId = card.cardId;

    // Listen for changes in comments
    db.collection('prayerRequests').doc(cardId).onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const commentsArray = data.comments || [];
        card.commentsData = commentsArray; // Store comments data in card

        // Clear the comments section
        commentsSection.innerHTML = '';

        if (commentsArray.length > 0) {
          // Display up to 2 comments
          commentsArray.forEach((comment, index) => {
            if (index < 2) {
              const commentElement = document.createElement('div');
              commentElement.innerHTML = `
                <div class="comment">
                  <strong>${comment.name}:</strong> ${comment.text}
                  <div class="comment-actions">
                    <button class="btn edit-comment-btn" data-index="${index}"><i class="fas fa-edit"></i></button>
                    <button class="btn delete-comment-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              `;
              commentsSection.appendChild(commentElement);

              // Attach event listeners to the edit and delete buttons
              const editBtn = commentElement.querySelector('.edit-comment-btn');
              const deleteBtn = commentElement.querySelector('.delete-comment-btn');

              editBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const commentIndex = parseInt(editBtn.getAttribute('data-index'));
                openEditCommentModal(card, commentIndex);
              });

              deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const commentIndex = parseInt(deleteBtn.getAttribute('data-index'));
                deleteComment(card, commentIndex);
              });
            }
          });

          // Show or hide the "See all comments" link
          if (commentsArray.length > 2) {
            showMoreComments.style.display = 'block';
          } else {
            showMoreComments.style.display = 'none';
          }

          // Update "See all comments" click event
          const newShowMoreComments = showMoreComments.cloneNode(true);
          showMoreComments.parentNode.replaceChild(newShowMoreComments, showMoreComments);

          newShowMoreComments.addEventListener('click', () => {
            $('#allCommentsModal').modal('show');
            const allCommentsContent = document.getElementById('all-comments-content');
            allCommentsContent.innerHTML = '';
            commentsArray.forEach((comment, index) => {
              const commentElement = document.createElement('div');
              commentElement.innerHTML = `
                <div class="comment">
                  <strong>${comment.name}:</strong> ${comment.text}
                  <div class="comment-actions">
                    <button class="btn edit-comment-btn" data-index="${index}"><i class="fas fa-edit"></i></button>
                    <button class="btn delete-comment-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              `;
              allCommentsContent.appendChild(commentElement);

              // Attach event listeners to the edit and delete buttons
              const editBtn = commentElement.querySelector('.edit-comment-btn');
              const deleteBtn = commentElement.querySelector('.delete-comment-btn');

              editBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const commentIndex = parseInt(editBtn.getAttribute('data-index'));
                openEditCommentModal(card, commentIndex);
                $('#allCommentsModal').modal('hide');
              });

              deleteBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                const commentIndex = parseInt(deleteBtn.getAttribute('data-index'));
                deleteComment(card, commentIndex);
              });
            });
          });
        } else {
          showMoreComments.style.display = 'none';
        }
      }
    });
  }

  // Function to open edit comment modal
  function openEditCommentModal(card, commentIndex) {
    const comment = card.commentsData[commentIndex];

    // Set the current comment data in the modal input fields
    document.getElementById('edit-comment-name').value = comment.name;
    document.getElementById('edit-comment-input').value = comment.text;

    // Store the card and commentIndex globally to use when saving
    window.currentEditingCard = card;
    window.currentEditingCommentIndex = commentIndex;

    // Show the edit comment modal
    $('#editCommentModal').modal('show');
  }

  // Event listener for saving edited comment
  document.getElementById('save-edit-comment-btn').addEventListener('click', () => {
    const card = window.currentEditingCard;
    const commentIndex = window.currentEditingCommentIndex;

    if (card && typeof commentIndex === 'number') {
      const editedName = document.getElementById('edit-comment-name').value.trim();
      const editedText = document.getElementById('edit-comment-input').value.trim();

      if (editedName && editedText) {
        const cardId = card.cardId;
        // Get the current comments array
        const commentsArray = card.commentsData;

        // Update the specific comment
        commentsArray[commentIndex] = {
          name: sanitizeInput(editedName),
          text: sanitizeInput(editedText)
        };

        // Update the comments array in Firestore
        db.collection('prayerRequests').doc(cardId).update({
          comments: commentsArray
        })
          .then(() => {
            $('#editCommentModal').modal('hide');
            // Clear the global variables
            window.currentEditingCard = null;
            window.currentEditingCommentIndex = null;
          })
          .catch((error) => {
            console.error('Error updating comment:', error);
            alert('Erro ao atualizar o comentário. Tente novamente.');
          });
      } else {
        alert('Por favor, preencha todos os campos do comentário.');
      }
    }
  });

  // Function to delete comment
  function deleteComment(card, commentIndex) {
    if (confirm('Tem certeza de que deseja excluir este comentário?')) {
      const cardId = card.cardId;
      const commentsArray = card.commentsData;

      // Remove the comment at the specified index
      commentsArray.splice(commentIndex, 1);

      // Update the comments array in Firestore
      db.collection('prayerRequests').doc(cardId).update({
        comments: commentsArray
      })
        .then(() => {
          // Comment deleted successfully
        })
        .catch((error) => {
          console.error('Error deleting comment:', error);
          alert('Erro ao excluir o comentário. Tente novamente.');
        });
    }
  }

  // Function to sanitize user input
  function sanitizeInput(input) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = input;
    return tempDiv.innerHTML;
  }

  // Clear form inputs after adding a new request
  function clearFormFields() {
    document.getElementById('new-title').value = '';
    document.getElementById('new-summary').value = '';
    document.getElementById('new-name').value = '';
  }

  // Function to open edit modal
  function openEditModal(card) {
    const title = card.querySelector('.card-title').textContent;
    const summaryElem = card.querySelector('.card-summary');
    const summary = summaryElem ? summaryElem.textContent.replace('Resumo: ', '') : '';
    const name = card.querySelector('.card-name').textContent;

    document.getElementById('edit-title').value = title;
    document.getElementById('edit-summary').value = summary;
    document.getElementById('edit-name').value = name;

    $('#editModal').modal('show');
  }

  // Event listener for saving edits
  document.getElementById('save-edit-btn').addEventListener('click', () => {
    if (activeCard) {
      const newTitle = document.getElementById('edit-title').value.trim();
      const newSummary = document.getElementById('edit-summary').value.trim();
      const newName = document.getElementById('edit-name').value.trim();

      if (newTitle && newSummary && newName) {
        const cardId = activeCard.cardId;
        db.collection('prayerRequests').doc(cardId).update({
          title: sanitizeInput(newTitle),
          summary: sanitizeInput(newSummary),
          name: sanitizeInput(newName)
        })
          .then(() => {
            $('#editModal').modal('hide');
            // Update the card display
            activeCard.querySelector('.card-title').textContent = newTitle;
            activeCard.querySelector('.card-name').textContent = newName;
            if (activeCard.classList.contains('expanded-card')) {
              const summaryElem = activeCard.querySelector('.card-summary');
              summaryElem.textContent = `Resumo: ${newSummary}`;
            }
            activeCard = null;
          })
          .catch((error) => {
            console.error('Error updating card:', error);
            alert('Erro ao atualizar o pedido. Tente novamente.');
          });

      } else {
        alert('Por favor, preencha todos os campos.');
      }
    }
  });

  // Event listener for confirming deletion
  document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (activeCard) {
      const cardId = activeCard.cardId;
      db.collection('prayerRequests').doc(cardId).delete()
        .then(() => {
          $('#deleteConfirmModal').modal('hide');
          activeCard = null;
          // The card will be removed via the onSnapshot listener
        })
        .catch((error) => {
          console.error('Error deleting card:', error);
          alert('Erro ao excluir o pedido. Tente novamente.');
        });
    }
  });

  // Open notifications modal on page load
  $(document).ready(function() {
    $('#notificationsModal').modal('show');
  });

  // Event listener for the notifications button
  const notificationsBtn = document.getElementById('notifications-btn');
  notificationsBtn.addEventListener('click', () => {
    $('#notificationsModal').modal('show');
  });

  // Apply blur effect when modal is open
  $('#notificationsModal').on('shown.bs.modal', function () {
    document.getElementById('main-content').classList.add('modal-blur');
  });

  $('#notificationsModal').on('hidden.bs.modal', function () {
    document.getElementById('main-content').classList.remove('modal-blur');
  });

  function loadPrayerRequests() {
    // If there's an existing listener, unsubscribe from it
    if (unsubscribePrayerRequests) {
      unsubscribePrayerRequests();
    }

    unsubscribePrayerRequests = db.collection('prayerRequests')
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        // Clear existing cards
        prayerRequestsContainer.innerHTML = '';

        if (!snapshot.empty) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            // Check if hasAnswer is false
            if (!data.hasAnswer) {
              const card = createSmallCard(data.title, data.summary, data.name, id);
              prayerRequestsContainer.appendChild(card);
            }
          });
          // If no cards were added
          if (prayerRequestsContainer.innerHTML === '') {
            prayerRequestsContainer.innerHTML = '<p>Nenhum pedido de oração disponível.</p>';
          }
        } else {
          prayerRequestsContainer.innerHTML = '<p>Nenhum pedido de oração disponível.</p>';
        }
      }, (error) => {
        console.error('Error fetching prayer requests:', error);
        prayerRequestsContainer.innerHTML = '<p>Erro ao carregar pedidos de oração. Por favor, tente novamente mais tarde.</p>';
      });
  }

  function loadAnsweredRequests() {
    // If there's an existing listener, unsubscribe from it
    if (unsubscribeAnsweredRequests) {
      unsubscribeAnsweredRequests();
    }

    unsubscribeAnsweredRequests = db.collection('prayerRequests')
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        // Clear existing cards
        answeredRequestsContainer.innerHTML = '';

        if (!snapshot.empty) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            // Check if hasAnswer is true
            if (data.hasAnswer) {
              const card = createSmallCard(data.title, data.summary, data.name, id);

              // Expand card to show answer
              expandCard(card, data.title, data.summary, data.name);

              // Display the answer
              const answerField = card.querySelector('.answer-field');
              answerField.style.display = 'block';
              answerField.querySelector('span').textContent = data.answer;

              // Remove unnecessary buttons for answered prayers
              const cardActions = card.querySelector('.card-actions');
              const answerBtn = cardActions.querySelector('.answer-btn');
              if (answerBtn) {
                answerBtn.style.display = 'none';
              }

              answeredRequestsContainer.appendChild(card);
            }
          });
          // If no cards were added
          if (answeredRequestsContainer.innerHTML === '') {
            answeredRequestsContainer.innerHTML = '<p>Nenhuma resposta de oração disponível.</p>';
          }
        } else {
          answeredRequestsContainer.innerHTML = '<p>Nenhuma resposta de oração disponível.</p>';
        }
      }, (error) => {
        console.error('Error fetching answered requests:', error);
        answeredRequestsContainer.innerHTML = '<p>Erro ao carregar respostas de oração. Por favor, tente novamente mais tarde.</p>';
      });
  }

});
