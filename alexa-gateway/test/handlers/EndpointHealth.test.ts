import { expect } from 'chai';
import 'mocha';
import handler from '../../src/handlers/EndpointHealth';

describe('EndpointHealth', function (){
    it('should map capability', async function (){
        const capability = handler.getCapability(['connectivity']);
        expect(capability);
    })

    it('should convert shadow to property', async function (){
        const property = handler.convertToProperty('connectivity', 'OK', {
            'timestamp': 100
        });
        expect(property)
    })
})