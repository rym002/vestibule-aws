import { expect } from 'chai';
import 'mocha';
import handler from '../../src/directive/PlaybackStateReporter';

describe('PlaybackStateReporter', function () {
    it('should map capability', async function () {
        const capability = handler.getCapability({ L: [{ S: 'playbackState' }] });
        expect(capability);
    })

    it('should convert shadow to property', async function () {
        const property = handler.convertToProperty('playbackState', { state: 'PLAYING' }, {
            state: {
                'timestamp': 100
            }
        });
        expect(property)
    })
})