<script>
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let player1 = '';
  export let player2 = '';
  export let score1 = 0;
  export let score2 = 0;
  export let raceTo = 0; // 0 means no race format
  export let matchId = '';

  const dispatch = createEventDispatcher();

  function increment(player) {
    if (player === 1) {
      score1++;
    } else {
      score2++;
    }
  }

  function decrement(player) {
    if (player === 1 && score1 > 0) {
      score1--;
    } else if (player === 2 && score2 > 0) {
      score2--;
    }
  }

  function submit() {
    const winner = score1 > score2 ? 'player1' : score2 > score1 ? 'player2' : null;
    dispatch('submit', {
      matchId,
      score1,
      score2,
      winner,
      player1,
      player2
    });
    close();
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  $: hasWinner = raceTo > 0
    ? (score1 >= raceTo || score2 >= raceTo)
    : (score1 !== score2 && (score1 > 0 || score2 > 0));

  $: player1Wins = raceTo > 0 ? score1 >= raceTo : score1 > score2;
  $: player2Wins = raceTo > 0 ? score2 >= raceTo : score2 > score1;
</script>

{#if isOpen}
  <div class="modal modal-open">
    <div class="modal-box bg-base-200 max-w-md">
      <h3 class="font-bold text-xl text-center mb-6">
        {#if raceTo > 0}
          Race to {raceTo}
        {:else}
          Enter Score
        {/if}
      </h3>

      <div class="flex items-center justify-between gap-4">
        <!-- Player 1 -->
        <div class="flex-1 text-center">
          <p class="font-medium mb-2 {player1Wins ? 'text-success' : ''}">{player1}</p>
          <div class="flex flex-col items-center gap-2">
            <button
              class="btn btn-circle btn-primary btn-lg"
              on:click={() => increment(1)}
              disabled={raceTo > 0 && score1 >= raceTo}
            >+</button>
            <span class="score-display {player1Wins ? 'text-success' : ''}">{score1}</span>
            <button
              class="btn btn-circle btn-ghost"
              on:click={() => decrement(1)}
              disabled={score1 === 0}
            >-</button>
          </div>
        </div>

        <!-- VS -->
        <div class="text-2xl font-bold text-base-content/30">vs</div>

        <!-- Player 2 -->
        <div class="flex-1 text-center">
          <p class="font-medium mb-2 {player2Wins ? 'text-success' : ''}">{player2}</p>
          <div class="flex flex-col items-center gap-2">
            <button
              class="btn btn-circle btn-primary btn-lg"
              on:click={() => increment(2)}
              disabled={raceTo > 0 && score2 >= raceTo}
            >+</button>
            <span class="score-display {player2Wins ? 'text-success' : ''}">{score2}</span>
            <button
              class="btn btn-circle btn-ghost"
              on:click={() => decrement(2)}
              disabled={score2 === 0}
            >-</button>
          </div>
        </div>
      </div>

      {#if raceTo > 0 && hasWinner}
        <div class="alert alert-success mt-6">
          <span class="font-bold">
            {player1Wins ? player1 : player2} wins the race!
          </span>
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn btn-ghost" on:click={close}>Cancel</button>
        <button
          class="btn btn-primary"
          on:click={submit}
          disabled={score1 === 0 && score2 === 0}
        >
          Save Result
        </button>
      </div>
    </div>
    <div class="modal-backdrop bg-black/50" on:click={close}></div>
  </div>
{/if}
