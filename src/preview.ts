type Tweet = {
  index: number;
  text: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  imageUrls: string[];
};

type AuthorGroup = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  tweets: Tweet[];
};

function groupByAuthor(tweets: Tweet[]): AuthorGroup[] {
  const groups: AuthorGroup[] = [];
  let current: AuthorGroup | null = null;

  tweets.forEach((tweet) => {
    if (current && current.username === tweet.username) {
      current.tweets.push(tweet);
    } else {
      current = {
        displayName: tweet.displayName,
        username: tweet.username,
        avatarUrl: tweet.avatarUrl,
        tweets: [tweet],
      };
      groups.push(current);
    }
  });

  return groups;
}

async function render() {
  const result = await chrome.storage.session.get('threadData');
  const tweets: Tweet[] = result.threadData || [];

  const content = document.getElementById('content') as HTMLDivElement;
  if (!tweets.length) {
    content.innerHTML = '<p>No tweet data found. Go to an X tweet or thread and click the extension button.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  const header = document.createElement('h1');
  header.textContent = 'X Thread / Tweet';
  fragment.appendChild(header);

  const groups = groupByAuthor(tweets);

  groups.forEach((group, groupIndex) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'author-group';

    const authorHeader = document.createElement('div');
    authorHeader.className = 'author-header';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'group-select';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      groupEl.classList.toggle('excluded', !checkbox.checked);
    });
    authorHeader.appendChild(checkbox);

    if (group.avatarUrl) {
      const avatar = document.createElement('img');
      avatar.src = group.avatarUrl;
      avatar.className = 'avatar';
      avatar.alt = '';
      authorHeader.appendChild(avatar);
    }

    const nameBlock = document.createElement('div');
    nameBlock.className = 'name-block';

    const displayName = document.createElement('div');
    displayName.className = 'display-name';
    displayName.textContent = group.displayName;
    nameBlock.appendChild(displayName);

    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = group.username;
    nameBlock.appendChild(username);

    authorHeader.appendChild(nameBlock);
    groupEl.appendChild(authorHeader);

    group.tweets.forEach((tweet) => {
      const tweetEl = document.createElement('div');
      tweetEl.className = 'tweet';

      const textP = document.createElement('p');
      const num = document.createElement('strong');
      num.textContent = `${tweet.index}. `;
      textP.appendChild(num);
      textP.appendChild(document.createTextNode(tweet.text));
      tweetEl.appendChild(textP);

      if (tweet.imageUrls.length) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'tweet-media';

        tweet.imageUrls.forEach((url) => {
          const img = document.createElement('img');
          img.src = url;
          img.alt = '';
          mediaContainer.appendChild(img);
        });

        tweetEl.appendChild(mediaContainer);
      }

      groupEl.appendChild(tweetEl);
    });

    fragment.appendChild(groupEl);

    if (groupIndex < groups.length - 1) {
      const separator = document.createElement('div');
      separator.className = 'group-separator';
      fragment.appendChild(separator);
    }
  });

  content.appendChild(fragment);

  document.getElementById('selectAllBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.author-group').forEach((el) => {
      const cb = el.querySelector('.group-select') as HTMLInputElement;
      cb.checked = true;
      el.classList.remove('excluded');
    });
  });

  document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.author-group').forEach((el) => {
      const cb = el.querySelector('.group-select') as HTMLInputElement;
      cb.checked = false;
      el.classList.add('excluded');
    });
  });

  document.getElementById('printBtn')?.addEventListener('click', () => {
    window.print();
  });
}

render();
