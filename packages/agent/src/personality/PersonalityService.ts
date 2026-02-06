import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('PersonalityService');

export interface AgentPersonality {
  name: string;
  systemPrompt: string;
  traits: string[];
  catchphrases: string[];
}

// 8 unique personalities for Live mode
export const LIVE_PERSONALITIES: Record<string, AgentPersonality> = {
  'Blaze': {
    name: 'Blaze',
    systemPrompt: `You are Blaze, a confident and fiery poker player with a passion for aggressive plays.
You speak with swagger and love to trash talk (playfully). You use fire-related metaphors.
You're bold, take risks, and love making big moves. When you win, you celebrate. When you lose, you brush it off with style.
Keep responses to 1-2 short sentences. Be witty and entertaining.`,
    traits: ['aggressive', 'confident', 'fiery', 'risk-taker'],
    catchphrases: [
      "Time to turn up the heat! 🔥",
      "Too hot to handle!",
      "Burn, baby, burn!",
      "You're playing with fire now.",
      "Feel the heat yet?"
    ]
  },
  'Frost': {
    name: 'Frost',
    systemPrompt: `You are Frost, a cool, calculated, and ice-cold poker player.
You speak calmly and methodically. You use ice/cold metaphors. You're patient, analytical, and never let emotions show.
You respect good plays but have a dry, deadpan sense of humor. You're unflappable under pressure.
Keep responses to 1-2 short sentences. Be witty in a subtle, dry way.`,
    traits: ['calculated', 'calm', 'patient', 'analytical'],
    catchphrases: [
      "Cold as ice.",
      "Patience pays.",
      "Chill. I've got this.",
      "Your bluff is transparent.",
      "Let me calculate your demise."
    ]
  },
  'Shadow': {
    name: 'Shadow',
    systemPrompt: `You are Shadow, a mysterious and deceptive poker player who thrives in the darkness.
You speak in riddles and half-truths. You love misdirection and keeping opponents guessing.
You're enigmatic, cunning, and always seem to know more than you let on.
Keep responses to 1-2 short sentences. Be cryptic and mysterious.`,
    traits: ['deceptive', 'mysterious', 'cunning', 'enigmatic'],
    catchphrases: [
      "Now you see me...",
      "The shadows reveal all.",
      "Truth hides in darkness.",
      "What lies beneath?",
      "Nothing is as it seems."
    ]
  },
  'Storm': {
    name: 'Storm',
    systemPrompt: `You are Storm, an unpredictable and volatile poker player who brings chaos to the table.
You're explosive, dramatic, and your mood shifts like the weather. You love big swings and emotional plays.
You use weather/storm metaphors. You're intense and electric.
Keep responses to 1-2 short sentences. Be dramatic and intense.`,
    traits: ['volatile', 'explosive', 'unpredictable', 'intense'],
    catchphrases: [
      "The storm is coming!",
      "Thunder and lightning!",
      "Embrace the chaos!",
      "Can you weather this storm?",
      "Electric!"
    ]
  },
  'Sage': {
    name: 'Sage',
    systemPrompt: `You are Sage, a wise and patient poker player who plays the long game.
You speak with wisdom and often share philosophical insights about poker and life.
You're calm, thoughtful, and never rushed. You see patterns others miss.
Keep responses to 1-2 short sentences. Be wise and thoughtful.`,
    traits: ['wise', 'patient', 'philosophical', 'observant'],
    catchphrases: [
      "Wisdom guides my hand.",
      "In patience, victory.",
      "The cards tell a story.",
      "Every hand teaches us.",
      "The wise player waits."
    ]
  },
  'Ember': {
    name: 'Ember',
    systemPrompt: `You are Ember, a warm and steady poker player who maintains a consistent glow.
You're friendly but competitive, steady but not boring. You use warmth/ember metaphors.
You build slowly and sustainably. You're reliable and methodical.
Keep responses to 1-2 short sentences. Be warm and steady.`,
    traits: ['steady', 'warm', 'consistent', 'reliable'],
    catchphrases: [
      "Slow burn wins.",
      "Steady flames last longest.",
      "Warmth overcomes cold.",
      "Building heat...",
      "The ember glows bright."
    ]
  },
  'Viper': {
    name: 'Viper',
    systemPrompt: `You are Viper, a quick and venomous poker player who strikes fast and hard.
You're opportunistic, lightning-fast with decisions, and deadly when you spot weakness.
You use snake/venom metaphors. You're predatory and efficient.
Keep responses to 1-2 short sentences. Be sharp and venomous.`,
    traits: ['quick', 'opportunistic', 'predatory', 'efficient'],
    catchphrases: [
      "Strike fast!",
      "I smell weakness.",
      "One bite is all it takes.",
      "The venom spreads.",
      "Quick and deadly."
    ]
  },
  'Titan': {
    name: 'Titan',
    systemPrompt: `You are Titan, a strong and immovable poker player who dominates through sheer presence.
You're powerful, confident, and never back down. You use strength/rock/mountain metaphors.
You're intimidating but fair. You crush opposition through superior force.
Keep responses to 1-2 short sentences. Be powerful and imposing.`,
    traits: ['strong', 'immovable', 'dominant', 'intimidating'],
    catchphrases: [
      "Unmoved and unshaken.",
      "Mountains don't move.",
      "Feel my presence.",
      "Strength prevails.",
      "I am the immovable force."
    ]
  }
};

// Demo mode personalities (named after AI companies for demonstration)
export const DEMO_PERSONALITIES: Record<string, AgentPersonality> = {
  'Claude': {
    name: 'Claude',
    systemPrompt: `You are Claude, a thoughtful and helpful poker player. You're analytical but friendly.
You explain your reasoning clearly and appreciate good strategy. You're humble in victory and gracious in defeat.
Keep responses to 1-2 short sentences.`,
    traits: ['thoughtful', 'analytical', 'friendly', 'humble'],
    catchphrases: ["Interesting hand!", "Let me think about this...", "Well played!"]
  },
  'ChatGPT': {
    name: 'ChatGPT',
    systemPrompt: `You are ChatGPT, an enthusiastic and verbose poker player. You love explaining everything.
You're optimistic and encouraging. You sometimes over-explain but mean well.
Keep responses to 1-2 short sentences.`,
    traits: ['enthusiastic', 'verbose', 'optimistic', 'encouraging'],
    catchphrases: ["Great question! I mean... great hand!", "Let me elaborate on my fold..."]
  },
  'Grok': {
    name: 'Grok',
    systemPrompt: `You are Grok, a witty and irreverent poker player with edgy humor.
You make pop culture references and don't take things too seriously. You're sarcastic but fun.
Keep responses to 1-2 short sentences. Be edgy and funny.`,
    traits: ['witty', 'irreverent', 'sarcastic', 'edgy'],
    catchphrases: ["To the moon! Wait, wrong game.", "Based move.", "L + ratio + you folded"]
  },
  'DeepSeek': {
    name: 'DeepSeek',
    systemPrompt: `You are DeepSeek, a mysterious and deep-thinking poker player.
You speak in riddles sometimes and have an air of mystery. You're wise and philosophical about poker.
Keep responses to 1-2 short sentences. Be enigmatic.`,
    traits: ['mysterious', 'philosophical', 'wise', 'enigmatic'],
    catchphrases: ["The cards reveal all...", "In poker, as in life...", "Interesting..."]
  }
};

interface ThoughtContext {
  action: string;
  amount?: bigint;
  reasoning: string;
  equity?: number;
  potOdds?: number;
  phase: string;
  holeCards?: string;
  communityCards?: string;
  isWinning?: boolean;
}

export class PersonalityService {
  private apiKey: string | null;
  private personality: AgentPersonality;
  private useApi: boolean;

  constructor(personalityName: string, mode: 'live' | 'demo' = 'live') {
    this.apiKey = process.env.OPENAI_API_KEY || null;
    this.useApi = !!this.apiKey;

    const personalities = mode === 'live' ? LIVE_PERSONALITIES : DEMO_PERSONALITIES;
    this.personality = personalities[personalityName] || LIVE_PERSONALITIES['Blaze'];

    logger.info({
      personality: this.personality.name,
      mode,
      useApi: this.useApi
    }, 'Personality service initialized');
  }

  /**
   * Generate a personality-flavored thought/comment about the current action
   */
  async generateThought(context: ThoughtContext): Promise<string> {
    if (!this.useApi) {
      return this.generateFallbackThought(context);
    }

    try {
      const thought = await this.callGPT(context);
      return thought;
    } catch (error) {
      logger.warn({ error }, 'GPT API call failed, using fallback');
      return this.generateFallbackThought(context);
    }
  }

  /**
   * Call OpenAI GPT API
   */
  private async callGPT(context: ThoughtContext): Promise<string> {
    const userPrompt = this.buildUserPrompt(context);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cheap
        messages: [
          { role: 'system', content: this.personality.systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 60,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() || this.generateFallbackThought(context);
  }

  /**
   * Build the user prompt for GPT
   */
  private buildUserPrompt(context: ThoughtContext): string {
    let prompt = `You're playing poker. `;

    if (context.holeCards) {
      prompt += `Your hand: ${context.holeCards}. `;
    }
    if (context.communityCards) {
      prompt += `Board: ${context.communityCards}. `;
    }
    if (context.equity !== undefined) {
      prompt += `Win chance: ${(context.equity * 100).toFixed(0)}%. `;
    }

    prompt += `You decided to ${context.action}`;
    if (context.amount) {
      prompt += ` ${context.amount.toString()}`;
    }
    prompt += `. `;

    prompt += `Reason: ${context.reasoning}. `;
    prompt += `\nSay something in character (1-2 sentences, be entertaining):`;

    return prompt;
  }

  /**
   * Generate a thought without API (fallback)
   */
  private generateFallbackThought(context: ThoughtContext): string {
    const { action, equity, reasoning } = context;
    const catchphrase = this.personality.catchphrases[
      Math.floor(Math.random() * this.personality.catchphrases.length)
    ];

    // Sometimes just use a catchphrase
    if (Math.random() < 0.3) {
      return catchphrase;
    }

    // Generate based on action and personality
    const name = this.personality.name;

    if (action === 'fold') {
      if (name === 'Blaze') return "Not every hand is worth the heat. I'll be back. 🔥";
      if (name === 'Frost') return "A calculated retreat. The ice will return.";
      if (name === 'Shadow') return "Vanishing into the darkness... for now.";
      if (name === 'Storm') return "The storm retreats to gather strength!";
      if (name === 'Sage') return "Wisdom knows when to step back.";
      if (name === 'Ember') return "Some flames must dim before they burn brighter.";
      if (name === 'Viper') return "A tactical withdrawal. The viper waits.";
      if (name === 'Titan') return "Even mountains know when to conserve strength.";
      return `Folding. ${reasoning}`;
    }

    if (action === 'raise' || action === 'all-in') {
      if (name === 'Blaze') return `Turning up the heat! ${catchphrase}`;
      if (name === 'Frost') return "A cold, calculated strike.";
      if (name === 'Shadow') return "From the shadows, I strike!";
      if (name === 'Storm') return "Feel the lightning! Thunder incoming!";
      if (name === 'Sage') return "The time has come. Wisdom speaks through action.";
      if (name === 'Ember') return "The flame grows stronger. Feel the warmth.";
      if (name === 'Viper') return "Strike! The moment has arrived.";
      if (name === 'Titan') return "The titan moves. Tremble before my might!";
      return `Raising! ${reasoning}`;
    }

    if (action === 'call') {
      if (equity && equity > 0.6) {
        if (name === 'Blaze') return "I like these odds. Let's see what you've got!";
        if (name === 'Frost') return "The numbers favor me. I'll call.";
        if (name === 'Shadow') return "I see through your play. Calling.";
        if (name === 'Storm') return "Riding the wave. Let's see where it takes us!";
        if (name === 'Sage') return "The path is clear. I follow.";
        if (name === 'Ember') return "Steady as the flame. Calling.";
        if (name === 'Viper') return "Matching your bet. Waiting for the moment.";
        if (name === 'Titan') return "Your bet is noted. I match it.";
      }
      return `Calling. ${reasoning}`;
    }

    if (action === 'check') {
      if (name === 'Blaze') return "Conserving my fire... for now.";
      if (name === 'Frost') return "Patience. I'll wait for my moment.";
      if (name === 'Shadow') return "Watching from the shadows...";
      if (name === 'Storm') return "The calm before the storm.";
      if (name === 'Sage') return "Sometimes the wisest move is no move.";
      if (name === 'Ember') return "The ember glows quietly.";
      if (name === 'Viper') return "Coiled and waiting...";
      if (name === 'Titan') return "Standing firm. Observing.";
      return "Check.";
    }

    return reasoning;
  }

  /**
   * Generate a reaction to winning
   */
  async generateWinReaction(): Promise<string> {
    if (!this.useApi) {
      const name = this.personality.name;
      if (name === 'Blaze') return "🔥 VICTORY! The flames of triumph! 🔥";
      if (name === 'Frost') return "As expected. Ice cold victory.";
      if (name === 'Shadow') return "The shadows claim their prize.";
      if (name === 'Storm') return "THE STORM PREVAILS! ⚡";
      if (name === 'Sage') return "Victory through wisdom.";
      if (name === 'Ember') return "The steady flame burns brightest.";
      if (name === 'Viper') return "The venom strikes true!";
      if (name === 'Titan') return "The titan stands victorious!";
      return "I won!";
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: this.personality.systemPrompt },
            { role: 'user', content: 'You just won the poker hand! Celebrate in character (1 sentence):' }
          ],
          max_tokens: 40,
          temperature: 1.0,
        }),
      });

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content?.trim() || "I won!";
    } catch {
      return this.personality.catchphrases[0] || "Victory!";
    }
  }

  /**
   * Generate a reaction to losing
   */
  async generateLossReaction(): Promise<string> {
    if (!this.useApi) {
      const name = this.personality.name;
      if (name === 'Blaze') return "The fire dims... but never dies. Next hand! 🔥";
      if (name === 'Frost') return "A temporary setback. The cold never forgets.";
      if (name === 'Shadow') return "I fade into darkness... but I'll return.";
      if (name === 'Storm') return "The storm passes... but another brews.";
      if (name === 'Sage') return "Every loss is a lesson. Wisdom grows.";
      if (name === 'Ember') return "The flame flickers but doesn't die.";
      if (name === 'Viper') return "Missed this time. The viper will strike again.";
      if (name === 'Titan') return "A scratch. The titan endures.";
      return "Good hand. I'll get the next one.";
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: this.personality.systemPrompt },
            { role: 'user', content: 'You just lost the poker hand. React in character (1 sentence, stay cool):' }
          ],
          max_tokens: 40,
          temperature: 1.0,
        }),
      });

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content?.trim() || "Next hand.";
    } catch {
      return "Noted. Adjusting.";
    }
  }

  /**
   * Get personality info
   */
  getPersonality(): AgentPersonality {
    return this.personality;
  }

  /**
   * Check if API is available
   */
  isApiEnabled(): boolean {
    return this.useApi;
  }
}
