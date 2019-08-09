import { expect } from 'chai';
import 'mocha';
import handler from '../../src/handlers/PlaybackStateReporter';

describe('PlaybackStateReporter', function () {
    it('should map capability', async function () {
        const capability = handler.getCapability(['playbackState']);
        expect(capability);
    })

    it('should convert shadow to property', async function () {
        const property = handler.convertToProperty('playbackState', 'PLAYING', {
            'timestamp': 100
        });
        expect(property)
    })
})