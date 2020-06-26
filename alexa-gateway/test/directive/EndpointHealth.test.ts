import { expect } from 'chai';
import 'mocha';
import handler from '../../src/directive/EndpointHealth';

describe('EndpointHealth', function () {
    it('should map capability', async function () {
        const capability = handler.getCapability({ L: [{ S: 'connectivity' }] });
        expect(capability);
    })

    it('should convert shadow to property', async function () {
        const property = handler.convertToProperty('connectivity', { value: 'OK' }, {
            value: {
                'timestamp': 100
            }
        });
        expect(property)
    })
})