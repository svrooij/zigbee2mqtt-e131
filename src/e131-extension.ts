import * as dgram from 'node:dgram'
import Device from 'zigbee2mqtt/dist/model/device'
import EventBus from 'zigbee2mqtt/dist/eventBus'
import Extension from 'zigbee2mqtt/dist/extension/extension'
import Group from 'zigbee2mqtt/dist/model/group'
import type Logger from 'zigbee2mqtt/dist/util/logger'
import MQTT from 'zigbee2mqtt/dist/mqtt'
import type Settings from 'zigbee2mqtt/dist/util/settings'
import State from 'zigbee2mqtt/dist/state'
import Zigbee from 'zigbee2mqtt/dist/zigbee'
import logger from 'zigbee2mqtt/dist/util/logger'

type StateChangeReason = 'publishDebounce' | 'groupOptimistic' | 'lastSeenChanged' | 'publishCached' | 'publishThrottle';

interface E131Config {
  universes: Array<{
        id: number;
        devices: string[];
        channelsPerDevice?: number;
    }>;
    enabled?: boolean;
    port?: number;
}

interface E131Packet {
    universeId: number;
    sequence: number;
    data: number[];
    priority?: number;
    sourceName?: string;
}

interface DeviceColorState {
    state: 'ON' | 'OFF';
    brightness?: number;
    color?: {
        x: number;
        y: number;
    };
    transition?: number;
}

class E131Extension extends Extension {
  private socket?: dgram.Socket;
  private universeMap?: Map<number, {devices: string[], channelsPerDevice: number}>
  private config: E131Config = { universes: [] };
  private readonly DEFAULT_SACN_PORT = 5568;
  constructor (
    zigbee: Zigbee,
    mqtt: MQTT,
    state: State,
    publishEntityState: (entity: Device | Group, payload: Record<string, unknown>, stateChangeReason?: StateChangeReason) => Promise<void>,
    eventBus: EventBus,
    enableDisableExtension: (enable: boolean, name: string) => Promise<void>,
    restartCallback: () => Promise<void>,
    addExtension: (extension: Extension) => Promise<void>,
    private logger:  typeof Logger,
    private settings: typeof Settings
  ) {
    super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);

  }

  override async start(): Promise<void> {

    this.config = this.getE131Config();

    if (!this.config.enabled) {
      this.logger.info('E1.31 extension: disabled in configuration');
      return;
    }

    if (this.config.universes.length === 0) {
      this.logger.warning('E1.31 extension: No universes configured');
      return;
    }

  }

  private getE131Config(): E131Config {
    try {
      const settings = this.settings.get() as unknown || {};
      if (typeof settings === 'object' && settings !== null) {
        const e131Config = (settings as any).e131 as E131Config | undefined;
        if (e131Config) {
          return e131Config;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get E131 config: ${error}`);
    }
    return { universes: [] };
  }
}

export = E131Extension