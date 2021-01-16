import { expect } from 'chai';
import 'mocha';
import handler from '../../src/directive/PlaybackStateReporter';

describe('PlaybackStateReporter', function () {
    it('should map capability', async function () {
        const capability = handler.getCapability({ L: [{ S: 'playbackState' }] });
        expect(capability);
    })
})