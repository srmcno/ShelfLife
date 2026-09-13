import { ARRIVALS, arrivalDraft } from '../content/arrivals.js';
import { renderPetSprite } from '../art/sprite.js';

export function createArrivalInvitation() {
  const invitation = document.createElement('div');
  invitation.className = 'empty-shelf arrival-invitation';
  const heading = document.createElement('div');
  heading.className = 'arrival-copy';
  heading.innerHTML = '<span class="empty-kicker">Room for someone peculiar</span><h1>Small creatures.<br>Long memories.</h1><p>Make a little life. Feed it, play together, and discover what it gets up to when you look away.</p>';
  const cast = document.createElement('div');
  cast.className = 'arrival-cast';
  for (const arrival of ARRIVALS) {
    const draft = arrivalDraft(arrival.id);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'arrival-resident';
    button.dataset.arrival = arrival.id;
    button.setAttribute('aria-label', 'Meet ' + arrival.name + '. ' + arrival.line + ' Customize before moving in.');
    const portrait = document.createElement('span');
    portrait.className = 'arrival-portrait'; portrait.setAttribute('aria-hidden', 'true');
    portrait.append(renderPetSprite({ id: 'arrival-' + arrival.id, art: { creature: draft.creature } }));
    const name = document.createElement('b'); name.textContent = arrival.name;
    const line = document.createElement('span'); line.className = 'arrival-line'; line.textContent = arrival.line;
    const action = document.createElement('span'); action.className = 'arrival-action'; action.textContent = 'Meet ' + arrival.name;
    button.append(portrait, name, line, action);
    button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('shelflife:create', { detail: { arrival: arrival.id } })));
    cast.append(button);
  }
  const footer = document.createElement('div'); footer.className = 'arrival-footer';
  const create = document.createElement('button'); create.type = 'button'; create.className = 'btn btn-ghost';
  create.textContent = 'Create someone entirely your own';
  create.addEventListener('click', () => document.getElementById('newPetBtn').click());
  const note = document.createElement('p'); note.textContent = 'Free to play. No account. Your shelf saves on this device.';
  footer.append(create, note);
  invitation.append(heading, cast, footer);
  return invitation;
}
