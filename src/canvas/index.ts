export const handler = (event: any, time: number) => {
    console.log('handler', event, time);
}

export const init = () => {
    const canvas = document.querySelector('#satori-canvas');
    if (!canvas) return handler

    console.log('canvas initialized', canvas)

    // TODO: setup canvas 

    return handler
}